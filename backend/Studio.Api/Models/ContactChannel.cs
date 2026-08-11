namespace Studio.Api.Models;

public class ContactChannel
{
    public int Id { get; set; }
    public int ProfileId { get; set; }

    /// <summary>e.g. "email", "phone", "linkedin", "github", "web".</summary>
    public required string Type { get; set; }

    public string? Label { get; set; }
    public required string Value { get; set; }
    public string? Url { get; set; }
    public Visibility Visibility { get; set; }
    public int SortOrder { get; set; }
}
