# Basebot

## Running the project

### Running gistbot + mailbot

1. Clone the mailbot repo in the same level with this repo (make sure to keep the mailbot name).
2. Read the secrets in both projects using `secrets:read`
3. Run `start:local` to start the docker compose
4. Run ngrok to open ports for both the slacker and mailbot using `ngrok:gistbot`

### Creating summaries

Summaries are created on our staging env on AWS. This means you gotta have a VPN working in order to access the staging env.

### Autenticating

Get a token by connecting to slack using the /slack/install endpoint. Open your browser at http://localhost:3000/slack/install and connect. You need to have the grok running in order to authenticate.

### Running bots

The different env bots have different commands to interact with.

1. `/gist-dev` to run the slash commands for the first
2. `/gist-dev2` to run the slash commands for the second

### Envs

We're running on a slack app. Working locally requires a tunnel to communicate with the slack backend. We use ngrok to create tunnels. Each slack app can only be configured to communicate with one tunnel.

We have 2 separate slack apps, meaning 2 concurrent users can work locally on the gistbot.

To run the second env use `ngrok:gistbot2` and `start:local2`. You w

## Debuging

### Bullboard

We use Bull as one of the queues. To view it's messages you can access the bullboard at http://localhost:3005/from your browser.

## Troubleshooting

- When switching between local envs, make sure to re install the slackbot again as they require different user tokens.
- /gist isn't working? Make sure to have the VPC connection working.
