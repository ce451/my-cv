namespace Studio.Api.Models;

/// <summary>
/// Controls where a piece of data may appear. ApplicationOnly data is used for
/// application documents (full CV PDF) and must never be published to the website.
/// </summary>
public enum Visibility
{
    Public,
    ApplicationOnly,
}
