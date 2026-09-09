// The real (live-Supabase) implementation of ProvisionDb. Kept separate from
// provision.ts so that file never has to import the Supabase client at all —
// it's tested with a fake ProvisionDb instead.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type {
  FixtureForProvisioning,
  ProvisionDb,
  YoutubeAccount,
} from "./provision.ts";

export function createSupabaseProvisionDb(client: SupabaseClient): ProvisionDb {
  return {
    async getFixture(fixtureId: string): Promise<FixtureForProvisioning> {
      const { data: fixture, error: fixtureError } = await client
        .from("fixtures")
        .select(
          "id, sport, scheduled_start, host_school_id, home_team_id, away_team_id",
        )
        .eq("id", fixtureId)
        .single();

      if (fixtureError || !fixture) {
        throw new Error(
          `Could not load fixture ${fixtureId}: ${
            fixtureError?.message ?? "not found"
          }`,
        );
      }

      // Two flat queries instead of an embedded-relation select: keeps the
      // supabase-js typing honest without generated Database types, and
      // doesn't depend on foreign-key constraint names staying stable.
      // away_team_id is null for a Clean Slate/Event fixture, so it's
      // filtered out here rather than passed into .in() as a literal null.
      const teamIds = [fixture.home_team_id, fixture.away_team_id].filter(
        (id): id is string => id !== null,
      );
      const { data: teams, error: teamsError } = await client
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      if (teamsError || !teams) {
        throw new Error(
          `Could not load teams for fixture ${fixtureId}: ${teamsError?.message}`,
        );
      }

      const homeTeam = teams.find((t) => t.id === fixture.home_team_id);
      const awayTeam = fixture.away_team_id
        ? teams.find((t) => t.id === fixture.away_team_id)
        : null;
      if (!homeTeam || (fixture.away_team_id && !awayTeam)) {
        throw new Error(
          `Fixture ${fixtureId} references a team that no longer exists`,
        );
      }

      return {
        id: fixture.id,
        sport: fixture.sport,
        scheduledStart: fixture.scheduled_start,
        hostSchoolId: fixture.host_school_id,
        homeTeamName: homeTeam.name,
        awayTeamName: awayTeam?.name ?? null,
      };
    },

    async getYoutubeAccountForSchool(
      schoolId: string,
    ): Promise<YoutubeAccount> {
      const { data: school, error: schoolError } = await client
        .from("schools")
        .select("youtube_account_id")
        .eq("id", schoolId)
        .single();

      if (schoolError) {
        throw new Error(
          `Could not load school ${schoolId}: ${schoolError.message}`,
        );
      }

      // Falls back to the platform's singleton account when the school
      // hasn't been pointed at its own (the default for every school).
      const query = school.youtube_account_id
        ? client.from("youtube_accounts").select(
          "id, channel_id, oauth_refresh_token",
        )
          .eq("id", school.youtube_account_id).single()
        : client.from("youtube_accounts").select(
          "id, channel_id, oauth_refresh_token",
        )
          .eq("owner_type", "platform").single();

      const { data: account, error: accountError } = await query;
      if (accountError || !account) {
        throw new Error(
          `Could not resolve a YouTube account for school ${schoolId}: ` +
            `${accountError?.message ?? "none found"}`,
        );
      }

      return {
        id: account.id,
        channelId: account.channel_id,
        oauthRefreshToken: account.oauth_refresh_token,
      };
    },

    async saveBroadcastCredentials(fixtureId, credentials): Promise<void> {
      const { error } = await client.from("fixture_broadcast_credentials")
        .upsert({
          fixture_id: fixtureId,
          youtube_broadcast_id: credentials.broadcastId,
          youtube_stream_key: credentials.streamKey,
          youtube_ingestion_address: credentials.ingestionAddress,
        });
      if (error) {
        throw new Error(
          `Could not save broadcast credentials for ${fixtureId}: ${error.message}`,
        );
      }
    },

    async setFixtureVideoId(fixtureId, videoId): Promise<void> {
      const { error } = await client
        .from("fixtures")
        .update({ youtube_video_id: videoId })
        .eq("id", fixtureId);
      if (error) {
        throw new Error(
          `Could not save video ID for fixture ${fixtureId}: ${error.message}`,
        );
      }
    },
  };
}
