import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { logsApi, type LogListParams } from '../../api/endpoints';

export const LOGS_REFRESH_MS = 10_000;

export function useLogs(params: LogListParams) {
  return useQuery({
    queryKey: ['logs', params],
    queryFn: () => logsApi.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: LOGS_REFRESH_MS,
  });
}
