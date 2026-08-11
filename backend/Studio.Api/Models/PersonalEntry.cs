namespace Studio.Api.Models;

/// <summary>
/// Personal section entries. Public entries are published as projects
/// (e.g. IoT, homelab); ApplicationOnly entries (marital status, driving
/// licence) stay in application documents.
/// </summary>
public class PersonalEntry
{
    public int Id { get; set; }
    public string? Label { get; set; }
    public required string Text { get; set; }
    public Visibility Visibility { get; set; }
    public int SortOrder { get; set; }
}
