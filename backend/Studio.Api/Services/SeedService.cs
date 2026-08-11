using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Studio.Api.Contracts;
using Studio.Api.Data;

namespace Studio.Api.Services;

/// <summary>One-time import: fills an empty database from data/seed.json (private, gitignored).</summary>
public class SeedService(StudioDbContext db, StudioPaths paths, ILogger<SeedService> logger)
{
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public async Task EnsureSeededAsync()
    {
        if (await db.Profiles.AnyAsync())
        {
            return;
        }

        if (!File.Exists(paths.SeedFile))
        {
            logger.LogWarning("Database is empty and no seed file found at {SeedFile}.", paths.SeedFile);
            return;
        }

        await using var stream = File.OpenRead(paths.SeedFile);
        var doc = await JsonSerializer.DeserializeAsync<CvDocument>(stream, JsonOptions)
                  ?? throw new InvalidOperationException($"Seed file {paths.SeedFile} is empty or invalid.");

        await CvRepository.ReplaceAllAsync(db, doc);
        logger.LogInformation("Seeded database from {SeedFile}.", paths.SeedFile);
    }
}
