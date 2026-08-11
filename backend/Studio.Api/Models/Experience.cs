namespace Studio.Api.Models;

public class Experience
{
    public int Id { get; set; }

    /// <summary>Period start, "YYYY-MM" or "YYYY".</summary>
    public required string Start { get; set; }

    /// <summary>Period end; null means ongoing ("heute").</summary>
    public string? End { get; set; }

    public required string Position { get; set; }
    public string? PositionNote { get; set; }
    public required string Organization { get; set; }
    public string? OrganizationNote { get; set; }
    public required string Summary { get; set; }
    public List<string> Bullets { get; set; } = [];
    public List<string> Tech { get; set; } = [];
    public int SortOrder { get; set; }
}
