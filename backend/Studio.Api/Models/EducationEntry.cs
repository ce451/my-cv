namespace Studio.Api.Models;

public class EducationEntry
{
    public int Id { get; set; }
    public required string Start { get; set; }
    public string? End { get; set; }
    public required string Institution { get; set; }
    public string? Program { get; set; }
    public string? Note { get; set; }
    public int SortOrder { get; set; }
}
