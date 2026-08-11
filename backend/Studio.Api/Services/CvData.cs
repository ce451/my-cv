using Studio.Api.Models;

namespace Studio.Api.Services;

/// <summary>Aggregate of all CV entities, passed between repository and mappers.</summary>
public record CvData(
    Profile Profile,
    List<Experience> Experiences,
    List<EducationEntry> Education,
    List<Internship> Internships,
    List<SkillCategory> Skills,
    List<LanguageSkill> Languages,
    List<PersonalEntry> Personal);
