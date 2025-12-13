// super simple in-memory store – reset on server restart
type SlackConfig = {
  webhookUrl: string;
};

type JiraConfig = {
  baseUrl: string;     // e.g. "https://yourdomain.atlassian.net"
  email: string;
  apiToken: string;
  projectKey: string;  // e.g. "CDP"
};

type IntegrationConfig = {
  slack?: SlackConfig;
  jira?: JiraConfig;
};

const store = new Map<string, IntegrationConfig>();

export function setSlackConfig(clientId: string, cfg: SlackConfig) {
  const existing = store.get(clientId) || {};
  store.set(clientId, { ...existing, slack: cfg });
}

export function setJiraConfig(clientId: string, cfg: JiraConfig) {
  const existing = store.get(clientId) || {};
  store.set(clientId, { ...existing, jira: cfg });
}

export function getConfig(clientId: string): IntegrationConfig | undefined {
  return store.get(clientId);
}
