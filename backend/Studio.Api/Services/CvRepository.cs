using Microsoft.EntityFrameworkCore;
using Studio.Api.Contracts;
using Studio.Api.Data;

namespace Studio.Api.Services;

public static class CvRepository
{
    public static async Task<CvDocument?> LoadDocumentAsync(StudioDbContext db)
    {
        var profile = await db.Profiles.Include(p => p.Contacts).AsNoTracking().FirstOrDefaultAsync();
        if (profile is null)
        {
            return null;
        }

        return CvMapper.ToDocument(new CvData(
            profile,
            await db.Experiences.AsNoTracking().ToListAsync(),
            await db.EducationEntries.AsNoTracking().ToListAsync(),
            await db.Internships.AsNoTracking().ToListAsync(),
            await db.SkillCategories.AsNoTracking().ToListAsync(),
            await db.Languages.AsNoTracking().ToListAsync(),
            await db.PersonalEntries.AsNoTracking().ToListAsync()));
    }

    /// <summary>Single-user tool: a full replace keeps API and editor trivial.</summary>
    public static async Task ReplaceAllAsync(StudioDbContext db, CvDocument doc)
    {
        var data = CvMapper.ToEntities(doc);

        await using var transaction = await db.Database.BeginTransactionAsync();

        db.ContactChannels.RemoveRange(db.ContactChannels);
        db.Profiles.RemoveRange(db.Profiles);
        db.Experiences.RemoveRange(db.Experiences);
        db.EducationEntries.RemoveRange(db.EducationEntries);
        db.Internships.RemoveRange(db.Internships);
        db.SkillCategories.RemoveRange(db.SkillCategories);
        db.Languages.RemoveRange(db.Languages);
        db.PersonalEntries.RemoveRange(db.PersonalEntries);
        await db.SaveChangesAsync();

        db.Profiles.Add(data.Profile);
        db.Experiences.AddRange(data.Experiences);
        db.EducationEntries.AddRange(data.Education);
        db.Internships.AddRange(data.Internships);
        db.SkillCategories.AddRange(data.Skills);
        db.Languages.AddRange(data.Languages);
        db.PersonalEntries.AddRange(data.Personal);
        await db.SaveChangesAsync();

        await transaction.CommitAsync();
    }
}
