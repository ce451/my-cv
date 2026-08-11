namespace Studio.Api.Models;

public class Profile
{
    public int Id { get; set; }
    public required string FullName { get; set; }
    public required string Role { get; set; }

    /// <summary>Single line shown directly under the name in the hero.</summary>
    public string? Tagline { get; set; }

    public required string Intro { get; set; }

    /// <summary>Skill keywords for the hero meta row (next to the contact links).</summary>
    public List<string> Highlights { get; set; } = [];

    /// <summary>Coarse location shown publicly (city only, per CLAUDE.md privacy rules).</summary>
    public required string LocationPublic { get; set; }

    /// <summary>Full address; application documents only, never published.</summary>
    public string? AddressFull { get; set; }

    /// <summary>Application documents only, never published.</summary>
    public DateOnly? BirthDate { get; set; }

    public List<ContactChannel> Contacts { get; set; } = [];
}
