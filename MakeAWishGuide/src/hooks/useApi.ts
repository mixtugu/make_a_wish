import { useMemo } from 'react';

import { createApi } from '../services/api';
import { useSettings } from '../settings/SettingsContext';

export function useApi() {
  const { settings } = useSettings();
  return useMemo(
    () => createApi({ url: settings.serverUrl, token: settings.apiToken }),
    [settings.serverUrl, settings.apiToken],
  );
}
