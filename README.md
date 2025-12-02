# ISOBEL

<div align="center">
  <img src=".github/songbird.png" width="600" alt="ISOBEL - A Discord Music Bot">
</div>

ISOBEL is a **highly-opinionated midwestern German self-hosted** Discord music bot **that doesn't suck**. It's made for small to medium-sized Discord servers/guilds (think about a group the size of you, your friends, and your friend's friends).

## Features

- 🎵 **High-Quality Audio**: 320kbps MP3 source with 192kbps Opus output for crystal-clear sound
- ⏹️ **Animated Progress Bar**: Real-time updating progress bars in Discord embeds
- 🎥 **Livestream Support**: Stream HLS live audio feeds
- ⏩ **Seeking**: Seek to any position within a song
- 💾 **Advanced Caching**: Local MP3 caching for instant playback and better performance
- 📋 **No Vote-to-Skip**: This is anarchy, not a democracy
- 🎶 **Starchild Music API**: Streams directly from the Starchild Music API (no YouTube or Spotify required)
- ↗️ **Custom Shortcuts**: Users can add custom shortcuts (aliases) for quick access
- 1️⃣ **One Song Per Command**: Predictable queue management - one song per `/play` command
- 🔄 **Smart Skipping**: Skip only works when more songs are queued - no errors at end of queue
- 🔊 **Volume Management**: Normalizes volume across tracks with automatic ducking when people speak
- ✍️ **TypeScript**: Written in TypeScript with full type safety, easily extendable
- ❤️ **Loyal Packers fan**

## Running

ISOBEL is written in TypeScript. You can either run ISOBEL with Docker (recommended) or directly with Node.js. Both methods require API keys passed in as environment variables.

### Environment Variables

Create a `.env` file in the project root with the following variables:

#### Required Variables

```env
DISCORD_TOKEN=your-discord-bot-token
STARCHILD_BASE_URL=https://your-api-url
STARCHILD_API_KEY=your-api's-key
```

- `DISCORD_TOKEN` - Your Discord bot token. Can be acquired [here](https://discordapp.com/developers/applications) by creating a 'New Application', then going to 'Bot'.
- `STARCHILD_BASE_URL` - The base URL for your Starchild Music API instance
- `STARCHILD_API_KEY` - Your Starchild Music API key. This unlocks streaming on the Starchild Music API. Create this key in your Starchild dashboard.

#### Optional Variables

```env
DATA_DIR=./data
CACHE_LIMIT=2GB

# SponsorBlock integration (optional)
# ENABLE_SPONSORBLOCK=true
# SPONSORBLOCK_TIMEOUT=5    # Delay (in minutes) before retrying when SponsorBlock servers are unreachable

# Bot status and activity (optional)
BOT_STATUS=online
# BOT_ACTIVITY_TYPE=LISTENING
# BOT_ACTIVITY_URL=
# BOT_ACTIVITY=music
```

- `DATA_DIR` - Directory for storing data files (defaults to `./data`)
- `CACHE_LIMIT` - Cache size limit (defaults to `2GB`, examples: `512MB`, `10GB`)
- `ENABLE_SPONSORBLOCK` - Set to `true` to enable SponsorBlock integration (defaults to `false`)
- `SPONSORBLOCK_TIMEOUT` - Delay (in minutes) before retrying when SponsorBlock servers are unreachable (defaults to `5`)
- `BOT_STATUS` - Bot presence status: `online`, `idle`, or `dnd` (defaults to `online`)
- `BOT_ACTIVITY_TYPE` - Activity type: `PLAYING`, `LISTENING`, `WATCHING`, or `STREAMING` (defaults to `LISTENING`)
- `BOT_ACTIVITY` - Activity text (defaults to `music`)
- `BOT_ACTIVITY_URL` - Required if using `STREAMING` activity type. A Twitch or YouTube stream URL.

**Complete `.env` example**:

```env
DISCORD_TOKEN=your-discord-bot-token-here
DATA_DIR=./data
STARCHILD_BASE_URL=https://your-api-url
STARCHILD_API_KEY=your-api's-key

############
# Optional #
############

CACHE_LIMIT=2GB

# ENABLE_SPONSORBLOCK=true
# SPONSORBLOCK_TIMEOUT=5    # Delay (in minutes) before retrying when SponsorBlock servers are unreachable

BOT_STATUS=online
# BOT_ACTIVITY_TYPE=LISTENING
# BOT_ACTIVITY_URL=
# BOT_ACTIVITY=music
```

ISOBEL will log a URL when run. Open this URL in a browser to invite ISOBEL to your server. ISOBEL will DM the server owner after it's added with setup instructions.

A 64-bit OS is required to run ISOBEL.

### Versioning

The `master` branch acts as the developing / bleeding edge branch and is not guaranteed to be stable.

When running a production instance, I recommend that you use the [latest release](https://github.com/soulwax/ISOBEL/releases/).

### 🐳 Docker

There are a variety of image tags available:
- `:2`: versions >= 2.0.0
- `:2.12`: versions >= 2.12.0 and < 2.13.0
- `:2.12.2`: an exact version specifier
- `:latest`: whatever the latest version is

**Basic Docker Run**:

```bash
docker run -it \
  -v "$(pwd)/data":/data \
  -e DISCORD_TOKEN='your-discord-token' \
  -e STARCHILD_API_KEY='your-starchild-api-key' \
  -e STARCHILD_BASE_URL='https://your-api-url' \
  ghcr.io/soulwax/ISOBEL:latest
```

This starts ISOBEL and creates a data directory in your current directory.

You can also store your tokens in an environment file and make it available to your container. By default, the container will look for a `/config` environment file. You can customize this path with the `ENV_FILE` environment variable to use with, for example, [docker secrets](https://docs.docker.com/engine/swarm/secrets/).

**Docker Compose**:

```yaml
services:
  isobel:
    image: ghcr.io/soulwax/ISOBEL:latest
    restart: always
    volumes:
      - ./data:/data
    environment:
      - DISCORD_TOKEN=your-discord-token
      - STARCHILD_API_KEY=your-api-key
      - STARCHILD_BASE_URL=your-api-url
      # Optional: Custom cache limit
      - CACHE_LIMIT=5GB
      # Optional: Bot status
      - BOT_STATUS=online
```

### Node.js

**Prerequisites**:
* Node.js (20.0.0 or later is required, latest 20.x.x LTS recommended)
* ffmpeg (4.1 or later)
* npm (comes with Node.js)

1. `git clone --recursive https://github.com/soulwax/ISOBEL.git && cd ISOBEL`
   - The `--recursive` flag is required to pull the web interface submodule located at `./web`
2. Copy `.env.example` to `.env` and populate with values:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```
3. I recommend checking out a tagged release with `git checkout v[latest release]`
4. Install dependencies: `npm install`
   - This will automatically initialize the web submodule and install its dependencies via the `postinstall` script
5. `npm run start`

**Note**: if you're on Windows, you may need to manually set the ffmpeg path. See [#345](https://github.com/soulwax/ISOBEL/issues/345) for details.

## ⚙️ Additional configuration (advanced)

### Cache

ISOBEL uses advanced local MP3 caching for optimal performance and sound quality. By default, ISOBEL limits the total cache size to around 2 GB. If you want to change this, set the environment variable `CACHE_LIMIT`. For example, `CACHE_LIMIT=512MB` or `CACHE_LIMIT=10GB`.

The cache stores high-quality MP3 files (320kbps) locally for instant playback, reducing API calls and ensuring consistent audio quality.

### Custom Bot Status

In the default state, ISOBEL has the status "Online" and the text "Listening to Music". You can change the status through environment variables:

- `BOT_STATUS`:
  - `online` (Online)
  - `idle` (Away)
  - `dnd` (Do not Disturb)

- `BOT_ACTIVITY_TYPE`:
  - `PLAYING` (Playing XYZ)
  - `LISTENING` (Listening to XYZ)
  - `WATCHING` (Watching XYZ)
  - `STREAMING` (Streaming XYZ)

- `BOT_ACTIVITY`: the text that follows the activity type

- `BOT_ACTIVITY_URL`: If you use `STREAMING` you MUST set this variable, otherwise it will not work! Here you write a regular YouTube or Twitch Stream URL.

#### Examples

**ISOBEL is watching a movie and is DND**:
```env
BOT_STATUS=dnd
BOT_ACTIVITY_TYPE=WATCHING
BOT_ACTIVITY=a movie
```

**ISOBEL is streaming Monstercat**:
```env
BOT_STATUS=online
BOT_ACTIVITY_TYPE=STREAMING
BOT_ACTIVITY_URL=https://www.twitch.tv/monstercat
BOT_ACTIVITY=Monstercat
```

**ISOBEL is in debugging mode**:
```env
BOT_STATUS=DEBUGGING
```

### SponsorBlock Integration

ISOBEL supports SponsorBlock integration to automatically skip non-music segments of tracks. To enable:

```env
ENABLE_SPONSORBLOCK=true
SPONSORBLOCK_TIMEOUT=5    # Delay (in minutes) before retrying when SponsorBlock servers are unreachable
```

### Automatic Volume Management

ISOBEL can automatically adjust volume when people speak in the voice channel:

- `/config set-reduce-vol-when-voice true` - Enable automatic volume reduction when people speak
- `/config set-reduce-vol-when-voice false` - Disable automatic volume reduction
- `/config set-reduce-vol-when-voice-target <volume>` - Set the target volume percentage when people speak (0-100, default is 70)

This feature ensures clear communication during conversations while maintaining music playback.

## 🎵 About Starchild Music API

ISOBEL uses the Starchild Music API for all music streaming and searching. This means:

- ✅ **No YouTube API keys required**
- ✅ **No Spotify credentials required**
- ✅ **Self-hosted or cloud-hosted API support**
- ✅ **High-quality audio streaming**
- ✅ **Fast and reliable search**

You'll need to set up your own Music API instance.

## 🔧 Development

If you want to contribute or develop ISOBEL:

1. Clone the repository with `git clone --recursive https://github.com/soulwax/ISOBEL.git`
   - The `--recursive` flag is required to pull the web interface submodule located at `./web`
   - If you forgot `--recursive`, you can initialize submodules later with `npm run submodule:init`
2. Install dependencies: `npm install`
   - This automatically initializes the web submodule and installs its dependencies via the `postinstall` script
3. Set up your `.env` file with required variables
4. Run in development mode: `npm run dev`
5. Run linting: `npm run lint` (or `npm run lint:all` for both bot and web)
6. Run type checking: `npm run typecheck` (or `npm run typecheck:all` for both bot and web)

### Unified Scripts

The project includes unified scripts that work across both the bot and web interface:

- `npm run lint:all` - Lint both bot and web projects
- `npm run lint:fix:all` - Auto-fix linting issues in both projects
- `npm run typecheck:all` - Type check both projects
- `npm run build:all` - Build both projects

### Web Interface Scripts

Access web interface commands from the root:

- `npm run web:dev` - Start web development server
- `npm run web:build` - Build web interface for production
- `npm run web:lint` - Lint web interface
- `npm run web:preview` - Preview production build

### Submodule Management

- `npm run submodule:init` - Initialize and update submodules
- `npm run submodule:update` - Update submodules to latest remote commits
- `npm run submodule:status` - Check submodule status

## 📝 License

GPLv3 - see LICENSE file for details.
