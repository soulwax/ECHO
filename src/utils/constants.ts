// File: src/utils/constants.ts

export const ONE_HOUR_IN_SECONDS = 60 * 60;
export const ONE_MINUTE_IN_SECONDS = 1 * 60;

/**
 * Discord API constants
 */
export const DISCORD_API_VERSION = '10' as const;

/**
 * Discord autocomplete choice limit (maximum choices per autocomplete response)
 */
export const DISCORD_AUTOCOMPLETE_MAX_CHOICES = 25;

/**
 * Discord pagination limit (maximum items per page)
 */
export const DISCORD_PAGINATION_LIMIT = 25;

/**
 * Minimum cache key length requirement
 */
export const MIN_CACHE_KEY_LENGTH = 4;

/**
 * Volume constants
 */
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 100;
export const VOLUME_DEFAULT = 100;

/**
 * Queue page size constants
 */
export const QUEUE_PAGE_SIZE_DEFAULT = 10;
export const QUEUE_PAGE_SIZE_MAX = 30;

/**
 * Progress bar segment count
 */
export const PROGRESS_BAR_SEGMENTS = 10;

/**
 * Audio player max missed frames (for livestreams)
 */
export const AUDIO_PLAYER_MAX_MISSED_FRAMES = 50;

/**
 * HTTP status code for gone/unavailable content
 */
export const HTTP_STATUS_GONE = 410;

/**
 * Interval for updating the now-playing embed (in milliseconds)
 * Set to 5 seconds to balance smoothness with Discord rate limits
 */
export const NOW_PLAYING_UPDATE_INTERVAL_MS = 5000;

/**
 * Audio bitrate in kbps for streaming
 */
export const AUDIO_BITRATE_KBPS = 192;
