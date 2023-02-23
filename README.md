# Basebot

## Running the project

### Initial setup

1. Run `npm i`
2. Install ngrok (https://www.ngrok.com), and set your token using `export NGROK_TOKEN=YOU_NGROK_AUTH_TOKEN` (change to your token). Add this to your .bashrc or .zshrc file.
3. Install docker desktop from their site (https://www.docker.com/products/docker-desktop)
4. Clone this and the mailbot repo in the same level with this repo (make sure to keep the mailbot name).

### Local envs

We're running on a slack app. Working locally requires a tunnel to communicate with the slack backend. We use ngrok to create tunnels. Each slack app can only be configured to communicate with one tunnel.

We have 4 separate slack apps, meaning 4 concurrent users can work locally on the gistbot.

- To run the second env use `ngrok2` and `start:local2` (to use the others just change the number)

### Running gistbot + mailbot

2. Read the secrets in both projects using `secrets:read`
3. Run `npm run start:local` to start the docker compose
4. Run ngrok to open ports for both the slacker and mailbot using `npm run ngrok`

### Creating summaries

Summaries are created on our staging env on AWS. This means you gotta have a VPN working in order to access the staging env.

### Autenticating

Get a token by connecting to slack using the /slack/install endpoint. Open your browser at http://localhost:3000/slack/install and connect. You need to have the grok running in order to authenticate.

### Running bots

The different env bots have different commands to interact with.

1. `/gist-dev` to run the slash commands for the first
2. `/gist-dev2` to run the slash commands for the second

## Debuging

### Bullboard

We use Bull as one of the queues. To view it's messages you can access the bullboard at http://localhost:3005/ from your browser.

### Postres (PgUtil)

In this project we use knex as the sql lib. When adding a new DB or migrating the DB, it's your job to create the tables and migrate stuff. On others projects we used TypeORM, in this project we don't. Make sure the DB is updated before merging your code!

## Troubleshooting

- When switching between local envs, make sure to re install the slackbot again as they require different user tokens.
- /gist isn't working? Make sure to have the VPC connection working.
