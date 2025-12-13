interface SlackConfig {
  webhookUrl: string;
  channel?: string;
}

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

interface ClientConfig {
  slack?: SlackConfig;
  jira?: JiraConfig;
}

const configStore: Map<string, ClientConfig> = new Map();

export function setSlackConfig(clientId: string, config: SlackConfig): void {
  const existing = configStore.get(clientId) || {};
  configStore.set(clientId, { ...existing, slack: config });
}

export function setJiraConfig(clientId: string, config: JiraConfig): void {
  const existing = configStore.get(clientId) || {};
  configStore.set(clientId, { ...existing, jira: config });
}

export function getConfig(clientId: string): ClientConfig | undefined {
  return configStore.get(clientId);
}
