using System.Text.Json;
using Studio.Api.Services;

namespace Studio.Tests;

public class PublishMapperTests
{
    private static readonly DateTimeOffset PublishedAt = new(2026, 8, 11, 12, 0, 0, TimeSpan.FromHours(2));

    [Fact]
    public void PublicView_ContainsOnlyPublicContacts()
    {
        var publicCv = PublishMapper.ToPublic(CvMapperTests.SampleDocument(), PublishedAt);

        var contact = Assert.Single(publicCv.Profile.Contacts);
        Assert.Equal("github", contact.Type);
    }

    [Fact]
    public void PublicView_MapsOnlyPublicPersonalEntriesToProjects()
    {
        var publicCv = PublishMapper.ToPublic(CvMapperTests.SampleDocument(), PublishedAt);

        var project = Assert.Single(publicCv.Projects);
        Assert.Equal("IoT", project.Title);
    }

    [Fact]
    public void PublicView_SetsMeta()
    {
        var publicCv = PublishMapper.ToPublic(CvMapperTests.SampleDocument(), PublishedAt, "de");

        Assert.Equal("de", publicCv.Meta.Locale);
        Assert.Equal(PublishedAt, DateTimeOffset.Parse(publicCv.Meta.PublishedAt));
    }

    /// <summary>
    /// The critical guarantee of the whole pipeline: application-only values
    /// must not survive into the serialized public JSON in any form.
    /// </summary>
    [Fact]
    public void SerializedPublicView_ContainsNoApplicationOnlyValues()
    {
        var publicCv = PublishMapper.ToPublic(CvMapperTests.SampleDocument(), PublishedAt);

        var json = JsonSerializer.Serialize(publicCv, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.DoesNotContain("Geheimgasse", json);
        Assert.DoesNotContain("1990-01-02", json);
        Assert.DoesNotContain("0660 0000000", json);
        Assert.DoesNotContain("Verheiratet", json);
        Assert.Contains("Weiz", json);
    }
}
