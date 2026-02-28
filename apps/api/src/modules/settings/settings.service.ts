import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Setting, SETTING_KEYS } from '../../entities/setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private settingRepository: Repository<Setting>,
  ) {}

  /**
   * Get a single setting value for a user
   */
  async get(userId: string, key: string): Promise<string | null> {
    const setting = await this.settingRepository.findOne({
      where: { userId, key },
    });
    return setting?.value ?? null;
  }

  /**
   * Get multiple settings for a user
   */
  async getMany(userId: string, keys: string[]): Promise<Record<string, string | null>> {
    const settings = await this.settingRepository.find({
      where: { userId, key: In(keys) },
    });

    const result: Record<string, string | null> = {};
    for (const key of keys) {
      const setting = settings.find((s) => s.key === key);
      result[key] = setting?.value ?? null;
    }
    return result;
  }

  /**
   * Get all settings for a user
   */
  async getAll(userId: string): Promise<Setting[]> {
    return this.settingRepository.find({ where: { userId } });
  }

  /**
   * Set a single setting value for a user
   */
  async set(userId: string, key: string, value: string | null): Promise<Setting> {
    let setting = await this.settingRepository.findOne({
      where: { userId, key },
    });

    if (setting) {
      setting.value = value;
    } else {
      setting = this.settingRepository.create({ userId, key, value });
    }

    return this.settingRepository.save(setting);
  }

  /**
   * Set multiple settings for a user in a single query
   */
  async setMany(userId: string, settings: Record<string, string | null>): Promise<void> {
    const entities = Object.entries(settings).map(([key, value]) =>
      this.settingRepository.create({ userId, key, value }),
    );

    await this.settingRepository.upsert(entities, {
      conflictPaths: ['userId', 'key'],
      skipUpdateIfNoValuesChanged: true,
    });
  }

  /**
   * Delete a single setting for a user
   */
  async delete(userId: string, key: string): Promise<void> {
    await this.settingRepository.delete({ userId, key });
  }

  /**
   * Delete multiple settings for a user
   */
  async deleteMany(userId: string, keys: string[]): Promise<void> {
    await this.settingRepository.delete({ userId, key: In(keys) });
  }

  /**
   * Get all Archidekt-related settings for a user
   */
  async getArchidektSettings(userId: string): Promise<{
    archidektId: number | null;
    archidektUsername: string | null;
    archidektEmail: string | null;
    archidektToken: string | null;
    archidektPassword: string | null;
    archidektConnectedAt: Date | null;
  }> {
    const keys = Object.values(SETTING_KEYS);
    const settings = await this.getMany(userId, keys);

    const archidektIdStr = settings[SETTING_KEYS.ARCHIDEKT_ID];
    const archidektConnectedAtStr = settings[SETTING_KEYS.ARCHIDEKT_CONNECTED_AT];

    return {
      archidektId: archidektIdStr ? parseInt(archidektIdStr, 10) : null,
      archidektUsername: settings[SETTING_KEYS.ARCHIDEKT_USERNAME],
      archidektEmail: settings[SETTING_KEYS.ARCHIDEKT_EMAIL],
      archidektToken: settings[SETTING_KEYS.ARCHIDEKT_TOKEN],
      archidektPassword: settings[SETTING_KEYS.ARCHIDEKT_PASSWORD],
      archidektConnectedAt: archidektConnectedAtStr ? new Date(archidektConnectedAtStr) : null,
    };
  }

  /**
   * Set all Archidekt-related settings for a user
   */
  async setArchidektSettings(
    userId: string,
    data: {
      archidektId: number;
      archidektUsername: string;
      archidektEmail: string;
      archidektToken: string;
      archidektPassword: string;
      archidektConnectedAt: Date;
    },
  ): Promise<void> {
    await this.setMany(userId, {
      [SETTING_KEYS.ARCHIDEKT_ID]: data.archidektId.toString(),
      [SETTING_KEYS.ARCHIDEKT_USERNAME]: data.archidektUsername,
      [SETTING_KEYS.ARCHIDEKT_EMAIL]: data.archidektEmail,
      [SETTING_KEYS.ARCHIDEKT_TOKEN]: data.archidektToken,
      [SETTING_KEYS.ARCHIDEKT_PASSWORD]: data.archidektPassword,
      [SETTING_KEYS.ARCHIDEKT_CONNECTED_AT]: data.archidektConnectedAt.toISOString(),
    });
  }

  /**
   * Clear all Archidekt-related settings for a user
   */
  async clearArchidektSettings(userId: string): Promise<void> {
    await this.deleteMany(userId, Object.values(SETTING_KEYS));
  }

  /**
   * Update Archidekt token for a user
   */
  async updateArchidektToken(userId: string, token: string): Promise<void> {
    await this.set(userId, SETTING_KEYS.ARCHIDEKT_TOKEN, token);
  }
}
