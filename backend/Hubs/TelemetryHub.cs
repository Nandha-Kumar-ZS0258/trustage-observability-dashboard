using Microsoft.AspNetCore.SignalR;
using TruStage.Observability.Api.Models;

namespace TruStage.Observability.Api.Hubs;

public class TelemetryHub : Hub
{
    public async Task BroadcastEvent(LiveFeedEventDto evt) =>
        await Clients.All.SendAsync("NewEvent", evt);
}
