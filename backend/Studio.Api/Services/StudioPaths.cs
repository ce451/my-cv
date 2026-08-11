namespace Studio.Api.Services;

/// <summary>
/// Resolves the local data directory (private, gitignored) and the repo
/// content directory (public) relative to the content root.
/// </summary>
public record StudioPaths(string DataDir, string DbFile, string SeedFile, string ContentDir)
{
    public static StudioPaths Resolve(IConfiguration config, IHostEnvironment env)
    {
        var root = env.ContentRootPath;
        var dataDir = Path.GetFullPath(Path.Combine(root, config["Studio:DataDir"] ?? "../data"));
        var contentDir = Path.GetFullPath(Path.Combine(root, config["Studio:ContentDir"] ?? "../../content"));
        Directory.CreateDirectory(dataDir);
        return new StudioPaths(
            dataDir,
            Path.Combine(dataDir, "studio.db"),
            Path.Combine(dataDir, "seed.json"),
            contentDir);
    }
}
