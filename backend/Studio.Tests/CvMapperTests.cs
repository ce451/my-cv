using Studio.Api.Contracts;
using Studio.Api.Models;
using Studio.Api.Services;

namespace Studio.Tests;

public class CvMapperTests
{
    internal static CvDocument SampleDocument() => new(
        new ProfileDto("Max Muster", "Dev", "Intro", "Weiz", "Geheimgasse 1, 8160 Weiz", "1990-01-02",
        [
            new ContactDto("github", "gh", "max", "https://github.com/max", Visibility.Public),
            new ContactDto("phone", null, "0660 0000000", null, Visibility.ApplicationOnly),
        ]),
        [new ExperienceDto("2020-01", null, "Dev", null, "ACME", null, "Summary", ["b1", "b2"], ["C#"])],
        [new EducationDto("2008", "2013", "HTL", "ET", null)],
        [new InternshipDto("2013", "ACME", null)],
        [new SkillCategoryDto("Backend", ["C#", ".NET"])],
        [new LanguageDto("Deutsch", "Muttersprache")],
        [
            new PersonalDto("IoT", "Public project", Visibility.Public),
            new PersonalDto(null, "Verheiratet", Visibility.ApplicationOnly),
        ]);

    [Fact]
    public void RoundTrip_PreservesDocument()
    {
        var doc = SampleDocument();

        var roundTripped = CvMapper.ToDocument(CvMapper.ToEntities(doc));

        Assert.Equivalent(doc, roundTripped, strict: true);
    }

    [Fact]
    public void ToEntities_AssignsSortOrderFromArrayPosition()
    {
        var data = CvMapper.ToEntities(SampleDocument());

        Assert.Equal([0, 1], data.Personal.Select(p => p.SortOrder));
        Assert.Equal([0, 1], data.Profile.Contacts.Select(c => c.SortOrder));
    }

    [Fact]
    public void ToDocument_OrdersBySortOrder()
    {
        var data = CvMapper.ToEntities(SampleDocument());
        data.Personal.Reverse();

        var doc = CvMapper.ToDocument(data);

        Assert.Equal("IoT", doc.Personal[0].Label);
    }
}
