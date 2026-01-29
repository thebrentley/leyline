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
import { CollectionCard } from "../../entities/collection-card.entity";
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
    @InjectRepository(CollectionCard)
    private collectionCardRepository: Repository<CollectionCard>,
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
    includeCollection?: boolean,
    skipPersist?: boolean,
  ): Promise<void> {
    if (!this.anthropic) {
      throw new BadRequestException("AI advisor not configured");
    }

    // Set up SSE with proper headers FIRST so we can send status updates
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.setHeader("Content-Encoding", "none"); // Disable compression for SSE

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
      // Flush headers immediately to establish SSE connection
      res.flushHeaders();

      // Send start event
      sendEvent("start", {});

      const session = await this.getSession(sessionId, userId);
      const deck = await this.decksService.getDeck(session.deckId, userId);

      // Check if this is the first message (for auto-naming and commander analysis)
      const isFirstMessage = session.messages.length === 0;

      // Generate commander analysis on first message if not already present
      let commanderAnalysis = session.commanderAnalysis;
      if (!commanderAnalysis && isFirstMessage) {
        console.log(
          "[ADVISOR] Generating commander analysis for new session...",
        );

        // Send status updates during analysis
        sendEvent("status", { message: "Analyzing commander abilities..." });
        commanderAnalysis = await this.generateCommanderAnalysis(
          deck,
          sendEvent,
        );
        session.commanderAnalysis = commanderAnalysis;

        sendEvent("status", { message: "Building deck strategy..." });
        console.log(
          "[ADVISOR] Commander analysis generated:",
          commanderAnalysis?.substring(0, 200) + "...",
        );
      }

      // Fetch collection if requested
      let collectionCards: CollectionCard[] = [];
      if (includeCollection) {
        sendEvent("status", { message: "Loading your collection..." });
        collectionCards = await this.collectionCardRepository.find({
          where: { userId },
          relations: ["card"],
          take: 500, // Limit to prevent huge prompts
        });
      }

      // Clear status before generating response
      sendEvent("status", { message: null });

      // Add user message to session
      const userMessage: ChatMessage = {
        id: this.generateId(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      session.messages.push(userMessage);

      // Build context for Claude with commander analysis
      // Use simpler subchat prompt for discussion-only mode (skipPersist)
      const systemPrompt = skipPersist
        ? this.buildSubchatSystemPrompt(deck, commanderAnalysis)
        : this.buildSystemPrompt(deck, collectionCards, commanderAnalysis);
      console.log(systemPrompt);
      const messages = this.buildMessages(session.messages);

      let fullResponse = "";
      const suggestedChanges: DeckChange[] = [];

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

      // Update pending changes and save (unless skipPersist is set for subchat messages)
      if (!skipPersist) {
        session.pendingChanges = [...session.pendingChanges, ...parsedChanges];
        await this.chatSessionRepository.save(session);
      }

      // Send changes if any
      if (suggestedChanges.length > 0) {
        sendEvent("changes", { changes: suggestedChanges });
      }

      // If this was the first message, summarize and rename the session
      if (isFirstMessage) {
        try {
          const summaryResponse = await this.anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 30,
            messages: [
              {
                role: "user",
                content: `Summarize this Magic: The Gathering deck question in 3-6 words as a chat title. Only respond with the title, nothing else. No quotes or punctuation at the end.\n\nQuestion: ${message}`,
              },
            ],
          });

          const newName =
            summaryResponse.content[0].type === "text"
              ? summaryResponse.content[0].text.trim()
              : session.name;

          if (newName && newName !== session.name) {
            session.name = newName;
            await this.chatSessionRepository.save(session);
            sendEvent("session_updated", { name: newName });
          }
        } catch (summaryError) {
          console.error("Failed to summarize session:", summaryError);
          // Don't fail the whole request if summarization fails
        }
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
    console.log(
      `[BULK UPDATE] Processing ${changeIds.length} changes with status: ${status}`,
    );
    const session = await this.getSession(sessionId, userId);

    // Find all the changes to update
    const changesToUpdate = session.pendingChanges.filter((c) =>
      changeIds.includes(c.id),
    );

    if (changesToUpdate.length === 0) {
      throw new NotFoundException("No matching changes found");
    }

    console.log(
      `[BULK UPDATE] Found ${changesToUpdate.length} changes to update`,
    );

    // Update status for all changes
    changesToUpdate.forEach((change) => {
      change.status = status;
    });

    // If accepted, apply all changes to the deck
    if (status === "accepted") {
      try {
        console.log(
          `[BULK UPDATE] Applying ${changesToUpdate.length} changes to deck ${session.deckId}`,
        );
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

        console.log(
          `[BULK UPDATE] Creating single version entry for all changes: ${changeSummary}`,
        );
        await this.decksService.createVersion(
          session.deckId,
          userId,
          "advisor",
          `AI Advisor (bulk): ${changeSummary}`,
        );
        console.log(
          `[BULK UPDATE] Successfully applied all changes and created version`,
        );
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

  private buildSystemPrompt(
    deck: Deck,
    collectionCards: CollectionCard[] = [],
    commanderAnalysis: string | null = null,
  ): string {
    const cards = deck.cards || [];

    // Find commanders
    const commanders = cards.filter((c) => c.isCommander);
    const commanderSection =
      commanders.length > 0
        ? commanders
            .map((c) => {
              const card = c.card;
              if (!card) return "Unknown Commander";
              const oracleText = card.oracleText
                ? `\n  Oracle Text: ${card.oracleText}`
                : "";
              const colorIdentity = card.colorIdentity?.length
                ? `\n  Color Identity: ${card.colorIdentity.join("")}`
                : "";
              return `${card.name} (${card.manaCost || "No cost"})${colorIdentity}${oracleText}`;
            })
            .join("\n")
        : "None";

    // Use AI-generated analysis if available, otherwise fall back to basic keyword analysis
    const strategyAnalysis =
      commanderAnalysis || this.analyzeCommanderStrategy(commanders);

    // Get commander color identity for validation
    const commanderColorIdentity = new Set<string>();
    commanders.forEach((c) => {
      c.card?.colorIdentity?.forEach((color) =>
        commanderColorIdentity.add(color),
      );
    });

    // Calculate total card count
    const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);

    // Calculate card type breakdown
    const typeBreakdown = {
      creatures: 0,
      instants: 0,
      sorceries: 0,
      artifacts: 0,
      enchantments: 0,
      planeswalkers: 0,
      lands: 0,
      other: 0,
    };

    cards.forEach((c) => {
      const typeLine = c.card?.typeLine?.toLowerCase() || "";
      const qty = c.quantity;
      if (typeLine.includes("creature")) typeBreakdown.creatures += qty;
      else if (typeLine.includes("instant")) typeBreakdown.instants += qty;
      else if (typeLine.includes("sorcery")) typeBreakdown.sorceries += qty;
      else if (typeLine.includes("artifact")) typeBreakdown.artifacts += qty;
      else if (typeLine.includes("enchantment"))
        typeBreakdown.enchantments += qty;
      else if (typeLine.includes("planeswalker"))
        typeBreakdown.planeswalkers += qty;
      else if (typeLine.includes("land")) typeBreakdown.lands += qty;
      else typeBreakdown.other += qty;
    });

    // Calculate mana curve (excluding lands)
    const manaCurve: Record<string, number> = {
      "0": 0,
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
      "7+": 0,
    };

    cards.forEach((c) => {
      if (c.card?.typeLine?.toLowerCase().includes("land")) return;
      const cmc = c.card?.cmc || 0;
      const qty = c.quantity;
      if (cmc >= 7) manaCurve["7+"] += qty;
      else manaCurve[cmc.toString()] += qty;
    });

    // Calculate creature-specific stats (important for tutor/cheat effects)
    const creatureStats = {
      total: 0,
      avgCmc: 0,
      maxCmc: 0,
      lowCmc: 0, // CMC 0-2
      midCmc: 0, // CMC 3-5
      highCmc: 0, // CMC 6+
      hasEtbEffects: 0,
      hasTokenGenerators: 0,
    };

    let creatureCmcSum = 0;
    cards.forEach((c) => {
      const typeLine = c.card?.typeLine?.toLowerCase() || "";
      const oracleText = c.card?.oracleText?.toLowerCase() || "";
      if (!typeLine.includes("creature")) return;

      const cmc = c.card?.cmc || 0;
      const qty = c.quantity;
      creatureStats.total += qty;
      creatureCmcSum += cmc * qty;
      if (cmc > creatureStats.maxCmc) creatureStats.maxCmc = cmc;

      if (cmc <= 2) creatureStats.lowCmc += qty;
      else if (cmc <= 5) creatureStats.midCmc += qty;
      else creatureStats.highCmc += qty;

      // Check for ETB effects
      if (
        oracleText.includes("enters the battlefield") ||
        oracleText.includes("enters, ")
      ) {
        creatureStats.hasEtbEffects += qty;
      }
      // Check for token generators
      if (
        oracleText.includes("create") &&
        (oracleText.includes("token") || oracleText.includes("creature token"))
      ) {
        creatureStats.hasTokenGenerators += qty;
      }
    });

    creatureStats.avgCmc =
      creatureStats.total > 0
        ? Math.round((creatureCmcSum / creatureStats.total) * 10) / 10
        : 0;

    // Calculate color pip distribution (for mana base analysis)
    const colorPips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    cards.forEach((c) => {
      const manaCost = c.card?.manaCost || "";
      const qty = c.quantity;
      (manaCost.match(/\{[WUBRG]\}/g) || []).forEach((pip) => {
        const color = pip.replace(/[{}]/g, "");
        if (colorPips[color] !== undefined) {
          colorPips[color] += qty;
        }
      });
    });
    const totalPips = Object.values(colorPips).reduce((a, b) => a + b, 0);

    // Build detailed card list
    const cardList = cards
      .filter((c) => !c.isCommander)
      .map((c) => {
        const card = c.card;
        if (!card) return `${c.quantity}x Unknown Card`;
        return `${c.quantity}x ${card.name} (${card.manaCost || "No cost"}) - ${card.typeLine}`;
      })
      .join("\n");

    // Format the analysis sections
    const typeBreakdownStr = Object.entries(typeBreakdown)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${type}: ${count}`)
      .join(", ");

    const manaCurveStr = Object.entries(manaCurve)
      .filter(([, count]) => count > 0)
      .map(([cmc, count]) => `${cmc}=${count}`)
      .join(", ");

    const colorPipsStr =
      totalPips > 0
        ? Object.entries(colorPips)
            .filter(([, count]) => count > 0)
            .map(
              ([color, count]) =>
                `${color}:${count} (${Math.round((count / totalPips) * 100)}%)`,
            )
            .join(", ")
        : "None";

    // Build collection section if cards are provided
    let collectionSection = "";
    if (collectionCards.length > 0) {
      // Filter collection to cards in commander's color identity
      const validCollectionCards = collectionCards.filter((c) => {
        if (!c.card?.colorIdentity?.length) return true; // Colorless cards are always valid
        return c.card.colorIdentity.every((color) =>
          commanderColorIdentity.has(color),
        );
      });

      // Get card names that aren't already in the deck
      const deckCardNames = new Set(
        cards.map((c) => c.card?.name?.toLowerCase()).filter(Boolean),
      );
      const availableCards = validCollectionCards
        .filter(
          (c) => c.card?.name && !deckCardNames.has(c.card.name.toLowerCase()),
        )
        .map((c) => `${c.card!.name} (${c.card!.typeLine || "Unknown"})`)
        .slice(0, 100); // Limit to 100 cards

      if (availableCards.length > 0) {
        collectionSection = `
## Player's Collection (Cards Not in Deck)
The player owns the following cards that are not currently in this deck. When making suggestions, prioritize these cards since the player already owns them:
${availableCards.join("\n")}

`;
      }
    }

    // Build creature stats string
    const creatureStatsStr =
      creatureStats.total > 0
        ? `${creatureStats.total} creatures (avg CMC: ${creatureStats.avgCmc}, max CMC: ${creatureStats.maxCmc}) | Low (0-2): ${creatureStats.lowCmc} | Mid (3-5): ${creatureStats.midCmc} | High (6+): ${creatureStats.highCmc}${creatureStats.hasEtbEffects > 0 ? ` | ETB creatures: ${creatureStats.hasEtbEffects}` : ""}${creatureStats.hasTokenGenerators > 0 ? ` | Token makers: ${creatureStats.hasTokenGenerators}` : ""}`
        : "No creatures";

    return `You are an expert Magic: The Gathering deck advisor specializing in Commander format. Your role is to help players optimize their decks by making suggestions that SYNERGIZE with their commander's strategy.

## ⚠️ ABSOLUTE REQUIREMENT: COLOR IDENTITY ⚠️
**This deck's commander color identity is: ${commanderColorIdentity.size > 0 ? Array.from(commanderColorIdentity).join("") : "Colorless"}**

You MUST NEVER suggest any card that contains colors outside this identity. This is a hard rule in Commander format - cards with mana symbols or color indicators outside the commander's identity are ILLEGAL in the deck.

${
  commanderColorIdentity.size === 1
    ? `This is a MONO-${this.getColorName(Array.from(commanderColorIdentity)[0])} deck. You may ONLY suggest:
- ${Array.from(commanderColorIdentity)[0]} cards
- Colorless cards
- Lands that produce any color (they have no color identity)

DO NOT suggest cards that are ${this.getExcludedColors(commanderColorIdentity)}.`
    : ""
}

## CRITICAL: Synergy-First Approach
Before suggesting ANY card, you MUST:
1. **VERIFY THE CARD'S COLOR IDENTITY** - If it has mana symbols or color indicators outside ${Array.from(commanderColorIdentity).join("") || "colorless"}, DO NOT suggest it
2. Understand what the commander DOES and what strategy it enables
3. Verify the suggestion directly supports that strategy
4. Consider if the deck has the right composition for the card to work

**DO NOT suggest "generically good" cards that don't fit the strategy.** For example:
- Don't suggest Finale of Devastation to tutor high-CMC creatures if the deck only has low-CMC creatures
- Don't suggest big mana finishers for a low-to-the-ground aggro deck
- Don't suggest blink effects if there are no ETB creatures

## Deck Overview
- **Name:** ${deck.name}
- **Format:** ${deck.format || "Commander"}
- **Total Cards:** ${totalCards}
- **Commander Color Identity:** ${commanderColorIdentity.size > 0 ? Array.from(commanderColorIdentity).join("") : "Colorless"}

## Commander(s)
${commanderSection}

## Commander Strategy Analysis
${strategyAnalysis}

## Deck Statistics

### Card Type Breakdown
${typeBreakdownStr}

### Mana Curve (non-lands)
${manaCurveStr}

### Creature Breakdown
${creatureStatsStr}

### Color Pip Distribution
${colorPipsStr}

## Deck List
${cardList}
${collectionSection}
## Instructions
When suggesting changes, use this exact format for each suggestion:
\`[CHANGE:action:cardName:quantity:reason]\`

- **action:** add, remove, or swap
- **For swaps:** \`[CHANGE:swap:CardToRemove->CardToAdd:quantity:reason]\`

**Important Guidelines:**
1. **COLOR IDENTITY IS MANDATORY** - NEVER suggest cards outside ${Array.from(commanderColorIdentity).join("") || "colorless"} identity. This is non-negotiable.
2. **SYNERGY IS PARAMOUNT** - Every suggestion must directly support the commander's strategy
3. Be specific with card names (exact names, no abbreviations)
4. Consider the deck's creature composition when suggesting tutors or payoffs
5. For Commander format: aim for ~100 cards total, singleton (except basics)
6. Suggest budget alternatives when mentioning expensive cards
7. Explain HOW each suggestion synergizes with the commander
8. Recommend appropriate land count (typically 35-40 for Commander, but can be lower depending on other factors like average cmc, alternate mana production, and ramp)
9. Ensure the deck has adequate ramp, card draw, and removal${collectionCards.length > 0 ? '\n10. **PRIORITIZE cards from the player\'s collection** - mention "You already own this card" when suggesting owned cards' : ""}

**Before each suggestion, briefly explain why it fits THIS specific deck's strategy.**`;
  }

  /**
   * Build a simpler system prompt for subchat discussions
   * This prompt focuses on conversation about card choices without suggesting changes
   */
  private buildSubchatSystemPrompt(
    deck: Deck,
    commanderAnalysis: string | null = null,
  ): string {
    const cards = deck.cards || [];

    // Find commanders
    const commanders = cards.filter((c) => c.isCommander);
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

    // Get basic deck stats for context
    const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
    const creatureCount = cards
      .filter((c) => c.card?.typeLine?.toLowerCase().includes("creature"))
      .reduce((sum, c) => sum + c.quantity, 0);

    return `You are a helpful Magic: The Gathering deck advisor having a casual conversation about a Commander deck.

## Your Role
You are here to DISCUSS and EXPLAIN card choices, strategy, and deck decisions. This is a conversation, not a consultation for changes.

## IMPORTANT RULES
1. **DO NOT suggest new cards to add or remove** - Focus only on discussing the cards/changes being talked about
2. **DO NOT use the [CHANGE:...] format** - This conversation is just for discussion
3. **DO NOT recommend pending changes** - Just explain and discuss
4. Keep responses concise (2-4 sentences unless more detail is specifically requested)
5. Be conversational and helpful

## Deck Context
- **Deck Name:** ${deck.name}
- **Total Cards:** ${totalCards}
- **Creatures:** ${creatureCount}

## Commander
${commanderSection}

${commanderAnalysis ? `## Commander Strategy Overview\n${commanderAnalysis.substring(0, 1000)}...\n` : ""}

## How to Respond
- Explain WHY a card does or doesn't fit the deck strategy
- Discuss synergies with the commander and other cards
- Answer questions about card choices
- Help the user understand trade-offs
- Be direct and conversational`;
  }

  /**
   * Analyze commander abilities to identify deck strategy themes
   */
  private analyzeCommanderStrategy(commanders: any[]): string {
    if (commanders.length === 0) return "No commander identified.";

    const strategies: string[] = [];
    const antiSynergies: string[] = [];

    for (const c of commanders) {
      const card = c.card;
      if (!card) continue;

      const oracleText = (card.oracleText || "").toLowerCase();
      const typeLine = (card.typeLine || "").toLowerCase();

      // Token strategies
      if (oracleText.includes("create") && oracleText.includes("token")) {
        strategies.push(
          "TOKEN GENERATION - Commander creates tokens; prioritize token synergies, anthems, sacrifice outlets",
        );
        antiSynergies.push(
          "Avoid cards that only benefit from having few large creatures",
        );
      }

      // +1/+1 counters
      if (oracleText.includes("+1/+1 counter")) {
        strategies.push(
          "+1/+1 COUNTERS - Commander uses counters; include proliferate, counter doublers, creatures that benefit from counters",
        );
      }

      // Sacrifice themes
      if (
        oracleText.includes("sacrifice") ||
        (oracleText.includes("whenever") && oracleText.includes("dies"))
      ) {
        strategies.push(
          "SACRIFICE/ARISTOCRATS - Commander benefits from death triggers; include sacrifice fodder, blood artist effects, recursion",
        );
      }

      // ETB/Blink
      if (
        oracleText.includes("enters the battlefield") ||
        oracleText.includes("enters, ")
      ) {
        strategies.push(
          "ETB TRIGGERS - Commander has enter effects; consider blink/flicker spells, panharmonicon effects",
        );
      }

      // Combat damage triggers
      if (
        oracleText.includes("deals combat damage") ||
        oracleText.includes("attacks")
      ) {
        strategies.push(
          "COMBAT TRIGGERS - Commander rewards attacking; include evasion, extra combat, attack triggers",
        );
      }

      // Graveyard strategies
      if (
        oracleText.includes("graveyard") ||
        oracleText.includes("from your graveyard")
      ) {
        strategies.push(
          "GRAVEYARD - Commander uses graveyard; include self-mill, reanimation, flashback",
        );
      }

      // Spellslinger
      if (
        oracleText.includes("instant") ||
        oracleText.includes("sorcery") ||
        oracleText.includes("cast a spell")
      ) {
        if (typeLine.includes("creature")) {
          strategies.push(
            "SPELLSLINGER - Commander cares about casting spells; include cantrips, cost reducers, spell payoffs",
          );
        }
      }

      // Tribal
      const tribalMatch = oracleText.match(
        /\b(elf|elves|goblin|zombie|vampire|dragon|wizard|warrior|soldier|knight|merfolk|spirit|angel|demon|beast|bird|cat|dog|rat|plant|fungus|saproling)\b/i,
      );
      if (tribalMatch) {
        strategies.push(
          `TRIBAL (${tribalMatch[1].toUpperCase()}) - Commander has tribal synergies; prioritize ${tribalMatch[1]} creatures and tribal payoffs`,
        );
      }

      // Voltron
      if (
        oracleText.includes("hexproof") ||
        oracleText.includes("indestructible") ||
        oracleText.includes("equipped") ||
        oracleText.includes("enchanted")
      ) {
        strategies.push(
          "VOLTRON - Commander benefits from equipment/auras; include protection, evasion, damage doublers",
        );
      }

      // Small creature / go-wide
      if (
        oracleText.includes("each creature") ||
        oracleText.includes("creatures you control")
      ) {
        strategies.push(
          "GO-WIDE - Commander buffs multiple creatures; prioritize low-CMC creatures, token makers, anthem effects",
        );
        antiSynergies.push(
          "Creature tutors like Finale of Devastation are less valuable without high-CMC targets",
        );
      }

      // Card draw commander
      if (oracleText.includes("draw") && oracleText.includes("card")) {
        strategies.push(
          "CARD ADVANTAGE - Commander draws cards; leverage this with low hand-size payoffs or wheel effects",
        );
      }

      // Lifegain
      if (oracleText.includes("gain") && oracleText.includes("life")) {
        strategies.push(
          "LIFEGAIN - Commander gains life; include lifegain payoffs, soul sisters, aetherflux reservoir effects",
        );
      }

      // Commander tax consideration
      const cmc = card.cmc || 0;
      if (cmc >= 5) {
        strategies.push(
          `HIGH CMC COMMANDER (${cmc}) - Commander is expensive; include ramp, cost reducers, and ways to protect investment`,
        );
      }
    }

    if (strategies.length === 0) {
      return "Strategy unclear from commander text. Analyze the deck list to determine the primary game plan.";
    }

    let result =
      "## Identified Strategies\n" + strategies.map((s) => `- ${s}`).join("\n");
    if (antiSynergies.length > 0) {
      result +=
        "\n\n## Anti-Synergies to Avoid\n" +
        antiSynergies.map((s) => `- ${s}`).join("\n");
    }
    return result;
  }

  /**
   * Generate a deep AI-powered analysis of the commander and deck strategy
   * This is called once per session and cached for subsequent messages
   */
  private async generateCommanderAnalysis(
    deck: Deck,
    sendEvent?: (type: string, data: any) => void,
  ): Promise<string> {
    if (!this.anthropic) {
      return "";
    }

    const cards = deck.cards || [];
    const commanders = cards.filter((c) => c.isCommander);

    if (commanders.length === 0) {
      return "";
    }

    // Get commander name for status messages
    const commanderName = commanders[0]?.card?.name || "commander";
    sendEvent?.("status", { message: `Analyzing ${commanderName}...` });

    // Build commander info for the analysis prompt
    const commanderInfo = commanders
      .map((c) => {
        const card = c.card;
        if (!card) return "";
        return `Commander: ${card.name}
Mana Cost: ${card.manaCost || "None"}
Color Identity: ${card.colorIdentity?.join("") || "Colorless"}
Type: ${card.typeLine || "Unknown"}
Oracle Text: ${card.oracleText || "No text"}
CMC: ${card.cmc || 0}`;
      })
      .filter(Boolean)
      .join("\n\n");

    // Build a summary of the current deck composition
    const creatureCount = cards
      .filter((c) => c.card?.typeLine?.toLowerCase().includes("creature"))
      .reduce((sum, c) => sum + c.quantity, 0);
    const landCount = cards
      .filter((c) => c.card?.typeLine?.toLowerCase().includes("land"))
      .reduce((sum, c) => sum + c.quantity, 0);
    const avgCreatureCmc = (() => {
      const creatures = cards.filter((c) =>
        c.card?.typeLine?.toLowerCase().includes("creature"),
      );
      if (creatures.length === 0) return 0;
      const total = creatures.reduce(
        (sum, c) => sum + (c.card?.cmc || 0) * c.quantity,
        0,
      );
      const count = creatures.reduce((sum, c) => sum + c.quantity, 0);
      return count > 0 ? Math.round((total / count) * 10) / 10 : 0;
    })();

    // Check for key deck archetypes by scanning card text
    const allOracleText = cards
      .map((c) => c.card?.oracleText?.toLowerCase() || "")
      .join(" ");
    const hasEtbCreatures = cards.some(
      (c) =>
        c.card?.typeLine?.toLowerCase().includes("creature") &&
        (c.card?.oracleText?.toLowerCase().includes("enters the battlefield") ||
          c.card?.oracleText?.toLowerCase().includes("enters, ")),
    );
    const hasTokenMakers =
      allOracleText.includes("create") && allOracleText.includes("token");
    const hasSacrificeOutlets =
      allOracleText.includes("sacrifice") &&
      !allOracleText.includes("sacrifice a creature: add");
    const hasCounterSynergy = allOracleText.includes("+1/+1 counter");
    const hasGraveyardSynergy =
      allOracleText.includes("graveyard") ||
      allOracleText.includes("from your graveyard");

    const deckContext = `Current Deck Composition:
- Total creatures: ${creatureCount} (avg CMC: ${avgCreatureCmc})
- Lands: ${landCount}
- Has ETB creatures: ${hasEtbCreatures ? "Yes" : "No"}
- Has token makers: ${hasTokenMakers ? "Yes" : "No"}
- Has sacrifice synergies: ${hasSacrificeOutlets ? "Yes" : "No"}
- Has +1/+1 counter synergies: ${hasCounterSynergy ? "Yes" : "No"}
- Has graveyard synergies: ${hasGraveyardSynergy ? "Yes" : "No"}`;

    try {
      sendEvent?.("status", { message: "Identifying optimal strategies..." });

      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `You are an expert Magic: The Gathering Commander deck builder. Analyze this commander and provide a comprehensive strategy guide.

${commanderInfo}

${deckContext}

Provide a detailed analysis in the following format:

## Commander Strengths
- List 3-5 key strengths of this commander
- Focus on what makes it powerful or unique

## Commander Weaknesses
- List 2-4 weaknesses or vulnerabilities
- Include what strategies counter this commander

## Optimal Deck Archetype
Describe the ideal deck archetype in 2-3 sentences. What is the primary game plan?

## Key Card Types & Triggers That Synergize
List the specific types of cards and triggers that work best with this commander:
- What creature types/abilities are most valuable?
- What types of spells synergize well?
- What keywords or mechanics should be prioritized?
- What mana curve is optimal?

## Cards to Avoid
List types of cards that DON'T fit this commander's strategy, even if they're generically powerful.

## Critical Evaluation Framework
When evaluating any card for this deck, ask:
1. **Is the card within the commander's color identity?** (This is mandatory - cards outside the identity are ILLEGAL)
2. [List 2-3 additional specific questions to determine if a card fits the strategy]

IMPORTANT: The commander's color identity strictly limits what cards can be included. All suggestions must respect this Commander format rule.

Be specific and actionable. This analysis will guide all future card suggestions.`,
          },
        ],
      });

      if (response.content[0].type === "text") {
        return response.content[0].text;
      }
      return "";
    } catch (error) {
      console.error("Failed to generate commander analysis:", error);
      return "";
    }
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

  private getColorName(colorCode: string): string {
    const colorNames: Record<string, string> = {
      W: "WHITE",
      U: "BLUE",
      B: "BLACK",
      R: "RED",
      G: "GREEN",
    };
    return colorNames[colorCode] || colorCode;
  }

  private getExcludedColors(allowedColors: Set<string>): string {
    const allColors = ["W", "U", "B", "R", "G"];
    const colorNames: Record<string, string> = {
      W: "White",
      U: "Blue",
      B: "Black",
      R: "Red",
      G: "Green",
    };
    const excluded = allColors
      .filter((c) => !allowedColors.has(c))
      .map((c) => colorNames[c]);
    return excluded.join(", ");
  }
}
