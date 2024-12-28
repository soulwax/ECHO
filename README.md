<p align="center">
   <img src=".github/ECHO.png" alt="Echo Bot" width="400"/>
   <h3 align="center">ECHO</h3>
   <p align="center">
      <a href="https://github.com/soulwax/Echo/issues">
         <img src="https://img.shields.io/badge/Report-Bug-red.svg" alt="Report Bug"/>
      </a>
      <a href="https://github.com/soulwax/Echo/issues">
         <img src="https://img.shields.io/badge/Request-Feature-blue.svg" alt="Request Feature"/>
      </a>
      <img src="https://img.shields.io/badge/Node.js-18.0%2B-green.svg" alt="Node.js Version"/>
      <img src="https://img.shields.io/badge/License-LGPL--3.0-yellow.svg" alt="License"/>
      <img src="https://img.shields.io/badge/Discord-Bot-7289DA.svg" alt="Discord Bot"/>
      <img src="https://img.shields.io/badge/TypeScript-Ready-3178C6.svg" alt="TypeScript Ready"/>
   </p>
   <p align="center">
      Made with ❤️ by <a href="https://github.com/soulwax">soulwax</a>
   </p>
</p>

------

Echo is a self-hosted no bs discord bot for music playback. It supports youtube **AND** spotify playback *in channel* and has a queue system. It also supports saving favorites, setting the volume by command, and many more music related (and even video) features and, if you have a **legal** download backend, you can /download embed songs from purely a query.

## Features

- **Music Playback**: Play music from various sources including YouTube and Spotify.
- **Queue Management**: Easily manage the playback queue with commands to play, pause, skip, and stop.
- **Favorites**: Save your favorite tracks for quick access.
- **Advanced Controls**: Control playback with commands like seek, loop, and shuffle.
- **Docker Support**: Easily deploy and run Echo in Docker containers for consistent and isolated environments.
- **Download**: Download songs from an endpoint you provide at your own risk.
- **Youtube**: Pull youtube videos with a command.
- **Volume**: Set the volume of the bot with a command.

**DATA SAFETY NOTE: The database is being used to store a user's favourite songs and the queue. It takes for that only a discord user ID, hashes it, only then stores it. This is to ensure that the bot is GDPR compliant and that the user's data is safe. The bot does not store any other data whatsoever, not even implied.**

## Commands

Echo supports a variety of commands for music playback and bot control. Here are some key commands:

- `play`: Play a song from YouTube or Spotify.
- `queue`: View the current music queue.
- `skip`: Skip the currently playing song.
- `unskip`: Unskip the last skipped song.
- `pause`: Pause playback.
- `resume`: Resume playback.
- `stop`: Stop playback and clear the queue.
- `volume`: Set the volume of the bot.
- `loop`: Loop the current song or queue.
- `shuffle`: Shuffle the queue.
- `seek`: Seek to a specific position in the current song.
- `download`: Download a song from an endpoint *you* provide at your own risk.
- `youtube`: Pull a youtube video with a command.
- `clear`: Clear the queue.
- `remove`: Remove a song from the queue.
- `replay`: Replay the current song.
- `fseek`: Fast seek to a specific position in the current song.
- `move`: Move a song to a specific position in the queue.
- `remove`: Remove a song from the queue.
- `seek`: Seek to a specific position in the current song.
- `replay`: Replay the current song.
- `favorites`: View your favorite songs.
- etc...

For a full list of commands, refer to the [Commands](https://github.com/soulwax/Echo/blob/main/src/commands) directory.

## Getting Started

### Prerequisites for Development

- Node.js (version >= 18.0.0)
- Yarn (for package management)
- pm2 (for process management)

Optional:

- Docker (for containerized deployment)

### Prerequisites for Deployment

- Docker (for containerized deployment)
- Copy the [`.env.example`](.env.example) file to `.env` and set the required environment variables.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/soulwax/Echo.git
   ```

2. Navigate to the project directory:

   ```bash
   cd Echo
   ```

3. Install dependencies:

   ```bash
   yarn
   ```

4. Build the project:

   ```bash
    yarn build
    ```
  
5. Create a `.env` file in the project root and set the following environment variables (see `.env.example` for reference):

   ```bash
   BOT_TOKEN=your_bot_token
   YOUTUBE_API_KEY=your_youtube_api_key
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ...
   ```

6. Start the bot via pm2:

   ```bash
   yarn start
   ```

### Configuration

1. Set up your `.env` file based on the provided `.env.example`.
2. Configure the bot token and music service API keys.

### Running the Bot

#### Database Setup

ECHO uses [Prisma](https://www.prisma.io/) as an Object-Relational Mapping (ORM) tool to interact with a database. To properly set up and manage the database, you'll need to run a few commands.

##### Generating Migrations

Whenever you make changes to the database schema defined in the Prisma schema file, you'll need to generate migration files. To do this, run the following command:

```bash
npm run migrations:generate
```

This command will generate new migration files based on the changes you've made to the schema.

##### Applying Migrations

After generating migration files, you need to apply them to your database to update its schema. Run the following command to apply pending migrations:

```bash
npm run migrations:run
```

This command will execute the migration files and bring the database schema up to date.

##### Starting the Bot

To start the bot and ensure that the database is properly set up, use the following command:

```bash
npm start
```

This command will set the necessary environment variables, apply any pending migrations, and then start the bot.

##### Generating Prisma Client

If you make changes to the Prisma schema, you'll need to regenerate the Prisma client to update the TypeScript types and client code. Run the following command to generate the Prisma client:

```bash
npm run prisma:generate
```

This command will generate the updated Prisma client based on your current schema.

##### Environment Variables

The `prisma:with-env` script is a helper command that sets the `DATABASE_URL` environment variable and then runs the `prisma` command. Make sure you have the correct database URL set in your environment variables before running any Prisma-related commands.

By following these steps and running the appropriate commands, you can ensure that your database is properly set up, migrations are applied, and the Prisma client is generated correctly for the ECHO Discord bot.

- To run the bot directly:

  ```bash
  npm start
  ```

- To run using Docker:

  ```bash
  docker-compose up
  ```

This will start the Echo bot in a Docker container with the specified configurations.

## Deploy with Docker

### *This is an excourse on Docker, in case you're not familiar with it you can deploy this bot without needing to know how to program.*

### Dockerfile explained

1. Base stage - sets up the foundation

   ```dockerfile
   FROM node:18-bullseye-slim AS base
   ```

   This starts with a slim Node.js 18 image based on Debian Bullseye. The `AS base` names this stage for reference.

2. Install system dependencies

   ```dockerfile
   # Install system dependencies
   RUN apt-get update \
      && apt-get install --no-install-recommends -y \
      ffmpeg \
      tini \
      openssl \
      ca-certificates \
      ...
   ```

   Installs required system packages. `tini` is particularly important as it acts as an init system within container.

3. Dependencies stage

   ```dockerfile
   # Dependencies stage - handles node modules
   FROM base AS dependencies
   WORKDIR /usr/app
   COPY package.json .
   COPY yarn.lock .

   # Install production dependencies
   RUN yarn install --prod
   RUN cp -R node_modules /usr/app/prod_node_modules

   # Install all dependencies (including dev dependencies)
   RUN yarn install
   ```

   This stage handles Node.js dependencies. It's nice since it separates production and development deps.

4. Build stage

   ```dockerfile
   # Builder stage - compiles TypeScript
   FROM dependencies AS builder
   COPY . .
   RUN yarn prisma generate
   RUN yarn build
   ```

   This stage compiles typescript into plain old JS.

5. Final stage

   ```dockerfile
   # Final stage - creates the production image
   FROM base AS runner
   WORKDIR /usr/app

   # Copy only what's needed from previous stages
   COPY --from=builder /usr/app/dist ./dist
   COPY --from=dependencies /usr/app/prod_node_modules node_modules
   COPY --from=builder /usr/app/node_modules/.prisma/client ./node_modules/.prisma/client
   ```

   This is using multi-stage builds to create a minimal production image. It only copies the necessary files from previous stages.

The Dockerfile is using several best practices:

1. **Multi-stage builds** - Reduces final image size by only including production necessities
2. **Layer caching** - Separates dependency installation from code copying for better rebuild performance
3. **Production optimization** - Separates prod and dev dependencies
4. **Init system** - Uses `tini` for proper process management
5. **Security** - Uses a slim base image and removes unnecessary files

   To build this image:

   ```bash
   docker build -t ECHO .
   ```

   To run it directly (though using docker-compose as shown earlier is recommended):

   ```bash
   ocker run -d \
   -v "$(pwd)/data":/data \
   -e DISCORD_TOKEN='your_token' \
   -e SPOTIFY_CLIENT_ID='your_id' \
   -e SPOTIFY_CLIENT_SECRET='your_secret' \
   -e YOUTUBE_API_KEY='your_key' \
   ECHO:latest
   ```

The relationship between Dockerfile and docker-compose.yml is:

- Dockerfile: Defines how to build your application image
- docker-compose.yml: Defines how to run your application (environment, volumes, networking, etc.)

## Roadmap

[ ] Enhance the `/youtube` command for more features.
[ ] Make the `/download` command more secure and possibly easier to set up.
[ ] Add Spotify support for playlists and albums.
[ ] Add video streaming support for YouTube.
[ ] Add playlist support for YouTube.
[ ] Add more advanced controls for playback.
[ ] Fetch more useful information about the song being played.
[ ] Add support for more commands and features.
[ ] Add spotify playback video support.
[ ] Add support for more music services.

## Contributing

Contributions to Echo are welcome! Please refer to the [Contributing Guidelines](CONTRIBUTING.md) for more information.

## License

Echo is licensed under the LGPL-3.0-or-later. See the [LICENSE](LICENSE) file for more details.
