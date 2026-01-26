import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import Anthropic from "@anthropic-ai/sdk";
import { ChatSession } from "../../entities/chat-session.entity";
import { Deck } from "../../entities/deck.entity";
import { DecksService } from "../decks/decks.service";
import { Response } from "express";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestedChanges?: DeckChange[];
}

interface DeckChange {
  id: string;
  action: "add" | "remove" | "swap";
  cardName: string;
  targetCardName?: string;
  quantity: number;
  reason: string;
  status: "pending" | "accepted" | "rejected";
}

@Injectable()
export class AdvisorService {
  private anthropic: Anthropic | null = null;

  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    @InjectRepository(Deck)
    private deckRepository: Repository<Deck>,
    private decksService: DecksService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get("ANTHROPIC_API_KEY");
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  /**
   * Get chat sessions for a deck
   */
  async getSessions(deckId: string, userId: string): Promise<ChatSession[]> {
    return this.chatSessionRepository.find({
      where: { deckId, userId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get a specific chat session
   */
  async getSession(sessionId: string, userId: string): Promise<ChatSession> {
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException("Chat session not found");
    }

    return session;
  }

  /**
   * Create a new chat session
   */
  async createSession(
    deckId: string,
    userId: string,
    name?: string,
  ): Promise<ChatSession> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    const session = this.chatSessionRepository.create({
      deckId,
      userId,
      name: name || `Chat ${new Date().toLocaleDateString()}`,
      messages: [],
      pendingChanges: [],
    });

    return this.chatSessionRepository.save(session);
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException("Chat session not found");
    }

    await this.chatSessionRepository.remove(session);
  }

  /**
   * Send a message and stream the response
   */
  async chat(
    sessionId: string,
    userId: string,
    message: string,
    res: Response,
  ): Promise<void> {
    if (!this.anthropic) {
      throw new BadRequestException("AI advisor not configured");
    }

    const session = await this.getSession(sessionId, userId);
    const deck = await this.decksService.getDeck(session.deckId, userId);

    // Add user message to session
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    session.messages.push(userMessage);

    // Build context for Claude
    const systemPrompt = this.buildSystemPrompt(deck);
    console.log(systemPrompt);
    const messages = this.buildMessages(session.messages);

    // Set up SSE with proper headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Disable compression for SSE
    res.setHeader("Content-Encoding", "none");

    let fullResponse = "";
    const suggestedChanges: DeckChange[] = [];

    // Helper to send SSE event
    const sendEvent = (type: string, data: any) => {
      const payload = JSON.stringify({ type, ...data });
      res.write(`data: ${payload}\n\n`);
      // Force flush to ensure immediate delivery
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    };

    try {
      // Send start event
      sendEvent("start", {});

      const stream = await this.anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const text = event.delta.text;
          fullResponse += text;

          // Send content chunk
          sendEvent("content", { content: text });
        }
      }

      // Parse suggested changes from response
      const parsedChanges = this.parseChanges(fullResponse);
      suggestedChanges.push(...parsedChanges);

      // Add assistant message to session
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: "assistant",
        content: fullResponse,
        timestamp: new Date(),
        suggestedChanges: parsedChanges,
      };
      session.messages.push(assistantMessage);

      // Update pending changes
      session.pendingChanges = [...session.pendingChanges, ...parsedChanges];

      await this.chatSessionRepository.save(session);

      // Send changes if any
      if (suggestedChanges.length > 0) {
        sendEvent("changes", { changes: suggestedChanges });
      }

      // Send done event
      sendEvent("done", {});
    } catch (error: any) {
      console.error("Chat streaming error:", error);
      sendEvent("error", { error: error.message || "An error occurred" });
    } finally {
      res.end();
    }
  }

  /**
   * Apply or reject a suggested change
   */
  async updateChangeStatus(
    sessionId: string,
    userId: string,
    changeId: string,
    status: "accepted" | "rejected",
  ): Promise<ChatSession> {
    const session = await this.getSession(sessionId, userId);

    const change = session.pendingChanges.find((c) => c.id === changeId);
    if (!change) {
      throw new NotFoundException("Change not found");
    }

    change.status = status;

    // If accepted, apply the change to the deck
    if (status === "accepted") {
      try {
        await this.applyChangeToDeck(session.deckId, userId, change);
      } catch (error) {
        console.error("Failed to apply change to deck:", error);
        throw new BadRequestException(
          `Failed to apply change: ${error.message}`,
        );
      }

      // Remove from pending after successful application
      session.pendingChanges = session.pendingChanges.filter(
        (c) => c.id !== changeId,
      );
    } else if (status === "rejected") {
      // Remove rejected changes from pending
      session.pendingChanges = session.pendingChanges.filter(
        (c) => c.id !== changeId,
      );
    }

    return this.chatSessionRepository.save(session);
  }

  /**
   * Bulk apply or reject multiple suggested changes
   */
  async bulkUpdateChangeStatus(
    sessionId: string,
    userId: string,
    changeIds: string[],
    status: "accepted" | "rejected",
  ): Promise<ChatSession> {
    console.log(`[BULK UPDATE] Processing ${changeIds.length} changes with status: ${status}`);
    const session = await this.getSession(sessionId, userId);

    // Find all the changes to update
    const changesToUpdate = session.pendingChanges.filter((c) =>
      changeIds.includes(c.id),
    );

    if (changesToUpdate.length === 0) {
      throw new NotFoundException("No matching changes found");
    }

    console.log(`[BULK UPDATE] Found ${changesToUpdate.length} changes to update`);

    // Update status for all changes
    changesToUpdate.forEach((change) => {
      change.status = status;
    });

    // If accepted, apply all changes to the deck
    if (status === "accepted") {
      try {
        console.log(`[BULK UPDATE] Applying ${changesToUpdate.length} changes to deck ${session.deckId}`);
        // Apply all changes
        for (const change of changesToUpdate) {
          switch (change.action) {
            case "add":
              await this.decksService.updateCardQuantity(
                session.deckId,
                change.cardName,
                change.quantity,
                userId,
              );
              break;

            case "remove":
              await this.decksService.updateCardQuantity(
                session.deckId,
                change.cardName,
                -change.quantity,
                userId,
              );
              break;

            case "swap":
              await this.decksService.updateCardQuantity(
                session.deckId,
                change.cardName,
                -change.quantity,
                userId,
              );
              await this.decksService.updateCardQuantity(
                session.deckId,
                change.targetCardName!,
                change.quantity,
                userId,
              );
              break;
          }
        }

        // Create a single version snapshot for all changes
        const changeSummary = changesToUpdate
          .map((c) => {
            if (c.action === "swap") {
              return `${c.action} ${c.quantity}x ${c.cardName} → ${c.targetCardName}`;
            }
            return `${c.action} ${c.quantity}x ${c.cardName}`;
          })
          .join(", ");

        console.log(`[BULK UPDATE] Creating single version entry for all changes: ${changeSummary}`);
        await this.decksService.createVersion(
          session.deckId,
          userId,
          "advisor",
          `AI Advisor (bulk): ${changeSummary}`,
        );
        console.log(`[BULK UPDATE] Successfully applied all changes and created version`);
      } catch (error) {
        console.error("Failed to apply bulk changes to deck:", error);
        throw new BadRequestException(
          `Failed to apply changes: ${error.message}`,
        );
      }

      // Remove all updated changes from pending
      session.pendingChanges = session.pendingChanges.filter(
        (c) => !changeIds.includes(c.id),
      );
    } else if (status === "rejected") {
      // Remove all rejected changes from pending
      session.pendingChanges = session.pendingChanges.filter(
        (c) => !changeIds.includes(c.id),
      );
    }

    return this.chatSessionRepository.save(session);
  }

  /**
   * Apply a change to the actual deck
   */
  private async applyChangeToDeck(
    deckId: string,
    userId: string,
    change: DeckChange,
  ): Promise<void> {
    console.log(
      `Applying change to deck ${deckId}: ${change.action} ${change.quantity}x ${change.cardName}`,
    );

    try {
      switch (change.action) {
        case "add":
          // Add cards to the deck (positive delta)
          await this.decksService.updateCardQuantity(
            deckId,
            change.cardName,
            change.quantity,
            userId,
          );
          break;

        case "remove":
          // Remove cards from the deck (negative delta)
          await this.decksService.updateCardQuantity(
            deckId,
            change.cardName,
            -change.quantity,
            userId,
          );
          break;

        case "swap":
          // Remove old card and add new card
          await this.decksService.updateCardQuantity(
            deckId,
            change.cardName,
            -change.quantity,
            userId,
          );
          await this.decksService.updateCardQuantity(
            deckId,
            change.targetCardName!,
            change.quantity,
            userId,
          );
          break;
      }

      // Create a version snapshot to track the AI advisor change
      await this.decksService.createVersion(
        deckId,
        userId,
        "advisor",
        `AI Advisor: ${change.action} ${change.quantity}x ${change.cardName}${change.targetCardName ? ` → ${change.targetCardName}` : ""}`,
      );
    } catch (error) {
      console.error("Failed to apply deck change:", error);
      throw error;
    }
  }

  private buildSystemPrompt(deck: Deck): string {
    // Find commanders
    const commanders = deck.cards?.filter((c) => c.isCommander) || [];
    const commanderSection =
      commanders.length > 0
        ? commanders
            .map((c) => {
              const card = c.card;
              if (!card) return "Unknown Commander";
              const oracleText = card.oracleText
                ? `\n  Oracle Text: ${card.oracleText}`
                : "";
              return `${card.name} (${card.manaCost || "No cost"})${oracleText}`;
            })
            .join("\n")
        : "None";

    // Calculate total card count
    const totalCards = deck.cards?.reduce((sum, c) => sum + c.quantity, 0) || 0;

    // Build detailed card list with oracle text
    const cardList = deck.cards
      ?.filter((c) => !c.isCommander) // Exclude commanders from main list
      .map((c) => {
        const card = c.card;
        if (!card) return `${c.quantity}x Unknown Card`;

        return `${c.quantity}x ${card.name} (${card.manaCost || "No cost"}) - ${card.typeLine}`;
      })
      .join("\n");

    return `You are an expert Magic: The Gathering deck advisor. You help players improve their decks with specific, actionable suggestions.

Current Deck: ${deck.name}
Format: ${deck.format || "Commander"}
Current number of cards: ${totalCards}

Commander(s):
${commanderSection}

Deck List:
${cardList}

When suggesting changes, use this exact format for each suggestion:
[CHANGE:action:cardName:quantity:reason]
- action: add, remove, or swap
- For swaps, use format: [CHANGE:swap:CardToRemove->CardToAdd:quantity:reason]

Be specific about card names. Explain your reasoning clearly. Consider:
- Mana curve and color balance
- Card synergies with the commander(s)
- Format-specific deck building rules and card limits
- Budget alternatives when relevant
- The current card count and whether cards need to be added/removed to meet format requirements`;
  }

  private buildMessages(
    messages: ChatMessage[],
  ): Array<{ role: "user" | "assistant"; content: string }> {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  private parseChanges(response: string): DeckChange[] {
    const changes: DeckChange[] = [];
    const changeRegex = /\[CHANGE:(\w+):([^:]+):(\d+):([^\]]+)\]/g;

    let match;
    while ((match = changeRegex.exec(response)) !== null) {
      const [, action, cardPart, quantity, reason] = match;

      if (action === "swap" && cardPart.includes("->")) {
        const [cardName, targetCardName] = cardPart.split("->");
        changes.push({
          id: this.generateId(),
          action: "swap",
          cardName: cardName.trim(),
          targetCardName: targetCardName.trim(),
          quantity: parseInt(quantity, 10),
          reason: reason.trim(),
          status: "pending",
        });
      } else {
        changes.push({
          id: this.generateId(),
          action: action as "add" | "remove",
          cardName: cardPart.trim(),
          quantity: parseInt(quantity, 10),
          reason: reason.trim(),
          status: "pending",
        });
      }
    }

    return changes;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
