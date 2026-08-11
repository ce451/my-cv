namespace Studio.Api.Contracts;

/// <summary>
/// Public view of the CV, written to content/cv.&lt;locale&gt;.json.
/// Structurally incapable of carrying application-only data: there are no
/// fields for address, birth date or non-public contact channels.
/// </summary>
public record PublicCv(
    PublicMeta Meta,
    PublicProfile Profile,
    List<PublicExperience> Experiences,
    List<PublicEducation> Education,
    List<PublicInternship> Internships,
    List<PublicSkillCategory> Skills,
    List<PublicLanguage> Languages,
    List<PublicProject> Projects);

public record PublicMeta(string PublishedAt, string Locale);

public record PublicProfile(
    string FullName,
    string Role,
    string Intro,
    string Location,
    List<PublicContact> Contacts);

public record PublicContact(string Type, string? Label, string Value, string? Url);

public record PublicExperience(
    string Start,
    string? End,
    string Position,
    string? PositionNote,
    string Organization,
    string? OrganizationNote,
    string Summary,
    List<string> Bullets,
    List<string> Tech);

public record PublicEducation(string Start, string? End, string Institution, string? Program, string? Note);

public record PublicInternship(string Years, string Organization, string? Note);

public record PublicSkillCategory(string Category, List<string> Items);

public record PublicLanguage(string Name, string Level);

public record PublicProject(string? Title, string Text);
