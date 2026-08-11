namespace Studio.Api.Models;

public class LanguageSkill
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Level { get; set; }
    public int SortOrder { get; set; }
}
