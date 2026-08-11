namespace Studio.Api.Models;

public class Internship
{
    public int Id { get; set; }

    /// <summary>Free-form years, e.g. "2010, 2011, 2012".</summary>
    public required string Years { get; set; }

    public required string Organization { get; set; }
    public string? Note { get; set; }
    public int SortOrder { get; set; }
}
