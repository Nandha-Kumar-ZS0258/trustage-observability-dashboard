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
    });

    conn.start().catch(console.error);
    return () => { conn.stop(); };
  }, [queryClient]);
};
