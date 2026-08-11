using Studio.Api.Models;

namespace Studio.Api.Contracts;

/// <summary>
/// Full editable CV document — includes application-only data.
/// Never published as-is; the public view is derived via PublishMapper.
/// </summary>
public record CvDocument(
    ProfileDto Profile,
    List<ExperienceDto> Experiences,
    List<EducationDto> Education,
    List<InternshipDto> Internships,
    List<SkillCategoryDto> Skills,
    List<LanguageDto> Languages,
    List<PersonalDto> Personal);

public record ProfileDto(
    string FullName,
    string Role,
    string Intro,
    string LocationPublic,
    string? AddressFull,
    string? BirthDate,
    List<ContactDto> Contacts);

public record ContactDto(string Type, string? Label, string Value, string? Url, Visibility Visibility);

public record ExperienceDto(
    string Start,
    string? End,
    string Position,
    string? PositionNote,
    string Organization,
    string? OrganizationNote,
    string Summary,
    List<string> Bullets,
    List<string> Tech);

public record EducationDto(string Start, string? End, string Institution, string? Program, string? Note);

public record InternshipDto(string Years, string Organization, string? Note);

public record SkillCategoryDto(string Category, List<string> Items);

public record LanguageDto(string Name, string Level);

public record PersonalDto(string? Label, string Text, Visibility Visibility);
