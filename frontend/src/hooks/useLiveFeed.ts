import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HubConnectionBuilder } from '@microsoft/signalr';

export const useLiveFeed = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/telemetry')
      .withAutomaticReconnect()
      .build();

    conn.on('NewEvent', () => {
      queryClient.invalidateQueries({ queryKey: ['overview-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['live-feed'] });
      queryClient.invalidateQueries({ queryKey: ['cu-health'] });
      queryClient.invalidateQueries({ queryKey: ['feed-ticker'] });
      queryClient.invalidateQueries({ queryKey: ['today-summary'] });
      queryClient.invalidateQueries({ queryKey: ['cu-status-grid'] });
      queryClient.invalidateQueries({ queryKey: ['unresolved-count'] });
    });

    conn.start().catch(console.error);
    return () => { conn.stop(); };
  }, [queryClient]);
};
