# GEMINI.md - Yumi's Lechon Web App

## Project Overview
**Yumi's Lechon Web App** is a backend system built with **.NET 10**, designed to serve as the API for a food business (Lechon). Currently, the project consists of a single Web API project using ASP.NET Core's **Minimal API** pattern.

- **Tech Stack:** .NET 10, ASP.NET Core, OpenAPI.
- **Architecture:** Minimal API.

## Project Structure
- `LechonSystem.Api/`: The main Web API project.
  - `Program.cs`: Entry point and API route definitions.
  - `appsettings.json`: Configuration settings.
  - `LechonSystem.Api.csproj`: Project dependencies and settings.

## Building and Running
To work with this project, you need the .NET 10 SDK installed.

- **Restore Dependencies:**
  ```bash
  dotnet restore
  ```
- **Build Project:**
  ```bash
  dotnet build
  ```
- **Run Application:**
  ```bash
  dotnet run --project LechonSystem.Api
  ```
- **Development Watch Mode:**
  ```bash
  dotnet watch --project LechonSystem.Api
  ```
- **OpenAPI / Swagger:**
  When running in development mode, the OpenAPI documentation is typically available at `/openapi/v1.json` or through a Swagger UI if added later.

## Development Conventions
- **C# Standards:** Adhere to standard C# and .NET coding conventions.
- **Minimal APIs:** New endpoints should be defined in `Program.cs` or organized into extension methods as the project grows.
- **Type Safety:** `Nullable` and `ImplicitUsings` are enabled by default.
- **Testing:** (TODO: Implement a test project using xUnit or NUnit).

## Roadmap / Next Steps
- [ ] Set up a database connection (e.g., PostgreSQL or SQL Server).
- [ ] Add Entity Framework Core for data access.
- [ ] Implement CRUD operations for Lechon orders and inventory.
- [ ] Add a testing project.
- [ ] Configure Authentication/Authorization.
