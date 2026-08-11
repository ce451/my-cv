using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Studio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTaglineHighlightsAndProjectLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Highlights",
                table: "Profiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "Tagline",
                table: "Profiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Links",
                table: "PersonalEntries",
                type: "TEXT",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Highlights",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "Tagline",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "Links",
                table: "PersonalEntries");
        }
    }
}
