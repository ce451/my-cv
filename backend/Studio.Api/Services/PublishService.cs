using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Studio.Api.Data;

namespace Studio.Api.Services;

/// <summary>Writes the public view of the CV to the repo's content/ directory.</summary>
public class PublishService(StudioDbContext db, StudioPaths paths, ILogger<PublishService> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
        WriteIndented = true,
        // Content files are diffed in git; keep umlauts readable.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public async Task<string> PublishAsync()
    {
        var doc = await CvRepository.LoadDocumentAsync(db)
                  ?? throw new InvalidOperationException("No CV data to publish — database is empty.");

        var publicCv = PublishMapper.ToPublic(doc, DateTimeOffset.Now);

        Directory.CreateDirectory(paths.ContentDir);
        var file = Path.Combine(paths.ContentDir, "cv.de.json");
        await File.WriteAllTextAsync(file, JsonSerializer.Serialize(publicCv, JsonOptions));

        logger.LogInformation("Published public CV to {File}.", file);
        return file;
    }
}
