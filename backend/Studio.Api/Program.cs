using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Studio.Api.Contracts;
using Studio.Api.Data;
using Studio.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var paths = StudioPaths.Resolve(builder.Configuration, builder.Environment);
builder.Services.AddSingleton(paths);
builder.Services.AddDbContext<StudioDbContext>(options => options.UseSqlite($"Data Source={paths.DbFile}"));
builder.Services.AddScoped<SeedService>();
builder.Services.AddScoped<PublishService>();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();

const string StudioCors = "studio";
builder.Services.AddCors(options => options.AddPolicy(StudioCors, policy => policy
    .WithOrigins("http://localhost:4200", "http://localhost:4201")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<StudioDbContext>().Database.Migrate();
    await scope.ServiceProvider.GetRequiredService<SeedService>().EnsureSeededAsync();

    // CLI mode: `dotnet run -- publish` migrates, seeds if empty, publishes and exits.
    if (args.Contains("publish"))
    {
        var file = await scope.ServiceProvider.GetRequiredService<PublishService>().PublishAsync();
        Console.WriteLine($"published: {file}");
        return;
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(StudioCors);

// Studio is a local-only tool (see CLAUDE.md): plain http on localhost, never deployed.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

var api = app.MapGroup("/api");

api.MapGet("/cv", async (StudioDbContext db) =>
    await CvRepository.LoadDocumentAsync(db) is { } doc ? Results.Ok(doc) : Results.NotFound());

api.MapPut("/cv", async (CvDocument doc, StudioDbContext db) =>
{
    await CvRepository.ReplaceAllAsync(db, doc);
    return Results.Ok(await CvRepository.LoadDocumentAsync(db));
});

api.MapPost("/publish", async (PublishService publish) =>
    Results.Ok(new { file = await publish.PublishAsync() }));

app.Run();
