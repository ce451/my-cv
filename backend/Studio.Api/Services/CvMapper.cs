using System.Globalization;
using Studio.Api.Contracts;
using Studio.Api.Models;

namespace Studio.Api.Services;

/// <summary>Pure mapping between the editable document and entities. List order is the sort order.</summary>
public static class CvMapper
{
    public static CvData ToEntities(CvDocument doc) => new(
        new Profile
        {
            FullName = doc.Profile.FullName,
            Role = doc.Profile.Role,
            Intro = doc.Profile.Intro,
            LocationPublic = doc.Profile.LocationPublic,
            AddressFull = doc.Profile.AddressFull,
            BirthDate = doc.Profile.BirthDate is { } birthDate
                ? DateOnly.Parse(birthDate, CultureInfo.InvariantCulture)
                : null,
            Contacts = doc.Profile.Contacts.Select((c, i) => new ContactChannel
            {
                Type = c.Type,
                Label = c.Label,
                Value = c.Value,
                Url = c.Url,
                Visibility = c.Visibility,
                SortOrder = i,
            }).ToList(),
        },
        doc.Experiences.Select((e, i) => new Experience
        {
            Start = e.Start,
            End = e.End,
            Position = e.Position,
            PositionNote = e.PositionNote,
            Organization = e.Organization,
            OrganizationNote = e.OrganizationNote,
            Summary = e.Summary,
            Bullets = [.. e.Bullets],
            Tech = [.. e.Tech],
            SortOrder = i,
        }).ToList(),
        doc.Education.Select((e, i) => new EducationEntry
        {
            Start = e.Start,
            End = e.End,
            Institution = e.Institution,
            Program = e.Program,
            Note = e.Note,
            SortOrder = i,
        }).ToList(),
        doc.Internships.Select((p, i) => new Internship
        {
            Years = p.Years,
            Organization = p.Organization,
            Note = p.Note,
            SortOrder = i,
        }).ToList(),
        doc.Skills.Select((s, i) => new SkillCategory
        {
            Category = s.Category,
            Items = [.. s.Items],
            SortOrder = i,
        }).ToList(),
        doc.Languages.Select((l, i) => new LanguageSkill
        {
            Name = l.Name,
            Level = l.Level,
            SortOrder = i,
        }).ToList(),
        doc.Personal.Select((p, i) => new PersonalEntry
        {
            Label = p.Label,
            Text = p.Text,
            Visibility = p.Visibility,
            SortOrder = i,
        }).ToList());

    public static CvDocument ToDocument(CvData data) => new(
        new ProfileDto(
            data.Profile.FullName,
            data.Profile.Role,
            data.Profile.Intro,
            data.Profile.LocationPublic,
            data.Profile.AddressFull,
            data.Profile.BirthDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            [.. data.Profile.Contacts.OrderBy(c => c.SortOrder)
                .Select(c => new ContactDto(c.Type, c.Label, c.Value, c.Url, c.Visibility))]),
        [.. data.Experiences.OrderBy(e => e.SortOrder)
            .Select(e => new ExperienceDto(e.Start, e.End, e.Position, e.PositionNote,
                e.Organization, e.OrganizationNote, e.Summary, [.. e.Bullets], [.. e.Tech]))],
        [.. data.Education.OrderBy(e => e.SortOrder)
            .Select(e => new EducationDto(e.Start, e.End, e.Institution, e.Program, e.Note))],
        [.. data.Internships.OrderBy(p => p.SortOrder)
            .Select(p => new InternshipDto(p.Years, p.Organization, p.Note))],
        [.. data.Skills.OrderBy(s => s.SortOrder)
            .Select(s => new SkillCategoryDto(s.Category, [.. s.Items]))],
        [.. data.Languages.OrderBy(l => l.SortOrder)
            .Select(l => new LanguageDto(l.Name, l.Level))],
        [.. data.Personal.OrderBy(p => p.SortOrder)
            .Select(p => new PersonalDto(p.Label, p.Text, p.Visibility))]);
}
