using Microsoft.EntityFrameworkCore;
using Studio.Api.Models;

namespace Studio.Api.Data;

public class StudioDbContext(DbContextOptions<StudioDbContext> options) : DbContext(options)
{
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<ContactChannel> ContactChannels => Set<ContactChannel>();
    public DbSet<Experience> Experiences => Set<Experience>();
    public DbSet<EducationEntry> EducationEntries => Set<EducationEntry>();
    public DbSet<Internship> Internships => Set<Internship>();
    public DbSet<SkillCategory> SkillCategories => Set<SkillCategory>();
    public DbSet<LanguageSkill> Languages => Set<LanguageSkill>();
    public DbSet<PersonalEntry> PersonalEntries => Set<PersonalEntry>();
}
