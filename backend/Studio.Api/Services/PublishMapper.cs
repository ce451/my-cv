using System.Text;
using Studio.Api.Contracts;
using Studio.Api.Models;

namespace Studio.Api.Services;

/// <summary>
/// Maps the full document to the public view. Application-only data is dropped
/// here; the target types have no fields that could carry it.
/// </summary>
public static class PublishMapper
{
    public static PublicCv ToPublic(CvDocument doc, DateTimeOffset publishedAt, string locale = "de") => new(
        new PublicMeta(publishedAt.ToString("O"), locale),
        new PublicProfile(
            doc.Profile.FullName,
            doc.Profile.Role,
            doc.Profile.Tagline,
            doc.Profile.Intro,
            doc.Profile.LocationPublic,
            [.. doc.Profile.Highlights],
            [.. doc.Profile.Contacts
                .Where(c => c.Visibility == Visibility.Public)
                .Select(ToPublicContact)]),
        [.. doc.Experiences.Select(e => new PublicExperience(e.Start, e.End, e.Position, e.PositionNote,
            e.Organization, e.OrganizationNote, e.Summary, [.. e.Bullets], [.. e.Tech]))],
        [.. doc.Education.Select(e => new PublicEducation(e.Start, e.End, e.Institution, e.Program, e.Note))],
        [.. doc.Internships.Select(p => new PublicInternship(p.Years, p.Organization, p.Note))],
        [.. doc.Skills.Select(s => new PublicSkillCategory(s.Category, [.. s.Items]))],
        [.. doc.Languages.Select(l => new PublicLanguage(l.Name, l.Level))],
        [.. doc.Personal
            .Where(p => p.Visibility == Visibility.Public)
            .Select(p => new PublicProject(p.Label, p.Text, [.. p.Links]))]);

    /// <summary>
    /// Spam-harvester protection (decision 12.08.2026): e-mail contacts leave
    /// the pipeline base64-encoded and without a mailto URL. The site renders
    /// only a placeholder and injects address and link after hydration, so the
    /// published JSON, the JS bundle and the prerendered HTML never contain
    /// the address in plain text.
    /// </summary>
    private static PublicContact ToPublicContact(ContactDto contact) => contact.Type == "email"
        ? new PublicContact(contact.Type, contact.Label,
            Convert.ToBase64String(Encoding.UTF8.GetBytes(contact.Value)), null)
        : new PublicContact(contact.Type, contact.Label, contact.Value, contact.Url);
}
