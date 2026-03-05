using TruStage.Observability.Api.Endpoints;
using TruStage.Observability.Api.Hubs;
using TruStage.Observability.Api.Repositories;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<ObservabilityRepository>();
builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                  ?? ["http://localhost:5173"];
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

app.UseCors();

app.MapOverviewEndpoints();
app.MapRunEndpoints();
app.MapCuEndpoints();
app.MapPerformanceEndpoints();
app.MapValidationEndpoints();
app.MapAlertEndpoints();

app.MapHub<TelemetryHub>("/hubs/telemetry");

app.Run();
