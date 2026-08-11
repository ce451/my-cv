var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Studio is a local-only tool (see CLAUDE.md); it is never deployed publicly.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
