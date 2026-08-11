namespace Studio.Api.Models;

public class SkillCategory
{
    public int Id { get; set; }
    public required string Category { get; set; }
    public List<string> Items { get; set; } = [];
    public int SortOrder { get; set; }
}
