// External services integration: Weather, Traffic/Commute, GNews, and GITAM Tracker

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  rainProbability: number; // percentage 0-100
  windSpeed: number;
}

export interface BikeDecision {
  verdict: "TAKE_BIKE" | "SKIP_BIKE" | "CAUTION";
  title: string;
  reason: string;
  details: string;
}

export interface NewsItem {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface GitamAttendanceData {
  overallPercentage: number;
  totalAttended: number;
  totalClasses: number;
  bunksRemaining: number;
  statusText: string;
  speech?: string;
  shortageCourses: { code: string; name: string; percentage: number; needed: number }[];
  todayClasses: { period: number; time: string; course: string; name?: string }[];
}

// WMO Weather code interpreter matching Apple Weather conditions
function interpretWmoCode(code: number): { description: string; icon: string; isRaining: boolean } {
  if (code === 0) return { description: "Clear sky", icon: "01d", isRaining: false };
  if (code === 1) return { description: "Mainly clear", icon: "02d", isRaining: false };
  if (code === 2) return { description: "Partly cloudy", icon: "03d", isRaining: false };
  if (code === 3) return { description: "Overcast", icon: "04d", isRaining: false };
  if (code >= 45 && code <= 48) return { description: "Foggy", icon: "50d", isRaining: false };
  if (code >= 51 && code <= 55) return { description: "Light drizzle", icon: "09d", isRaining: true };
  if (code >= 61 && code <= 65) return { description: "Rain", icon: "10d", isRaining: true };
  if (code >= 80 && code <= 82) return { description: "Rain showers", icon: "09d", isRaining: true };
  if (code >= 95) return { description: "Thunderstorm", icon: "11d", isRaining: true };
  return { description: "Partly cloudy", icon: "02d", isRaining: false };
}

// 1. Live Weather Fetcher (High-resolution ECMWF / Apple Weather equivalent)
export async function getLiveWeather(): Promise<WeatherData> {
  const lat = process.env.USER_DEST_LAT || "17.7813"; // Rushikonda / GITAM coordinates
  const lon = process.env.USER_DEST_LON || "83.3768";

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&hourly=precipitation_probability&timezone=Asia%2FKolkata`;

    const res = await fetch(url, { next: { revalidate: 300 } }); // Cache 5 minutes
    if (!res.ok) throw new Error(`Open-Meteo returned status ${res.status}`);

    const data = await res.json();
    const current = data.current;
    const wmo = interpretWmoCode(current.weather_code ?? 2);

    // Check upcoming commute window (current hour + next 2 hours)
    const now = new Date();
    const hour = now.getHours();
    const nextHoursPrecip = data.hourly?.precipitation?.slice(hour, hour + 3) || [];
    const totalWindowRainMm = nextHoursPrecip.reduce((acc: number, val: number) => acc + (val || 0), 0);

    const currentRainMm = current.precipitation ?? 0;
    const isActuallyRaining = currentRainMm > 0.1 || totalWindowRainMm > 0.2;

    // Actual rain probability during the commute window:
    // If meteorological model shows 0.0 mm rain for current and upcoming hours,
    // the rain risk is practically 5-10% (safe for bike).
    let rainProb = 5;
    if (isActuallyRaining) {
      rainProb = Math.min(Math.max(data.hourly?.precipitation_probability?.[hour] ?? 60, 65), 100);
    } else {
      // Partly cloudy or clear with 0.0 mm rain
      const rawPop = data.hourly?.precipitation_probability?.[hour] ?? 10;
      rainProb = Math.min(rawPop, 20); // capped at 20% when 0.0 mm rainfall
    }

    return {
      city: "Rushikonda, GITAM University",
      temp: Math.round(current.temperature_2m ?? 29),
      feelsLike: Math.round(current.apparent_temperature ?? 32),
      humidity: current.relative_humidity_2m ?? 76,
      description: wmo.description,
      icon: wmo.icon,
      rainProbability: rainProb,
      windSpeed: Math.round(current.wind_speed_10m ?? 5),
    };
  } catch (error) {
    console.warn("Open-Meteo fetch failed, using fallback:", error);
    return {
      city: "Rushikonda, GITAM University",
      temp: 29,
      feelsLike: 32,
      humidity: 76,
      description: "Partly cloudy",
      icon: "02d",
      rainProbability: 10,
      windSpeed: 5,
    };
  }
}

// 2. Commute & Bike Decision Engine
export function evaluateBikeDecision(weather: WeatherData): BikeDecision {
  const threshold = Number(process.env.RAIN_THRESHOLD_PERCENT || 60);

  if (weather.rainProbability >= threshold) {
    return {
      verdict: "SKIP_BIKE",
      title: "Skip the bike today 🌧️",
      reason: `Rain risk is at ${weather.rainProbability}%, above your ${threshold}% limit.`,
      details: "Take a cab, bus, or car for your 40-min commute to GITAM. Not worth getting drenched.",
    };
  }

  if (weather.temp > 39) {
    return {
      verdict: "CAUTION",
      title: "Bike with caution (High Heat) ☀️",
      reason: `Temperature is ${weather.temp}°C with high humidity.`,
      details: "Stay hydrated and carry a water bottle for the 40 min ride across town.",
    };
  }

  return {
    verdict: "TAKE_BIKE",
    title: "Bike is a yes 🏍️💨",
    reason: `${weather.temp}°C, ${weather.description}, only ${weather.rainProbability}% rain risk.`,
    details: "Weather's clean. Gopalapatnam to GITAM Rushikonda is about 40 mins. You're clear to ride.",
  };
}

// 3. News Fetcher (High-Relevance AI, Apple, Developer, Tech)
export async function getFilteredNews(): Promise<NewsItem[]> {
  const apiKey = process.env.GNEWS_API_KEY || "";
  try {
    const res = await fetch(
      `https://gnews.io/api/v4/top-headlines?category=technology&lang=en&max=10&apikey=${apiKey}`,
      { next: { revalidate: 3600 } } // Cache 1 hour
    );

    if (!res.ok) {
      throw new Error(`GNews returned status ${res.status}`);
    }

    const data = await res.json();
    if (!data.articles || !Array.isArray(data.articles)) {
      return [];
    }

    // High relevance keywords for developer, AI, Apple, and frontier tech
    const positiveKw = [
      "ai", "artificial intelligence", "llm", "apple", "iphone", "mac", "google",
      "openai", "model", "software", "tech", "chip", "cyber", "robot", "security",
      "developer", "coding", "startup", "india"
    ];
    // Exclude noise, retail footwear, celebrity gossip, and non-tech clickbait
    const negativeKw = [
      "shoe", "sneaker", "colorway", "beer", "gossip", "deal", "discount", "sale",
      "fashion", "nfl", "football", "horoscope"
    ];

    const scored = data.articles
      .map((art: any) => {
        const text = `${art.title || ""} ${art.description || ""}`.toLowerCase();
        let score = 0;
        for (const kw of positiveKw) {
          if (text.includes(kw)) score += 2;
        }
        for (const neg of negativeKw) {
          if (text.includes(neg)) score -= 10;
        }
        return {
          title: art.title?.trim() || "",
          description: art.description?.trim() || "",
          source: art.source?.name || "Tech News",
          url: art.url || "",
          publishedAt: art.publishedAt || new Date().toISOString(),
          score,
        };
      })
      .filter((art: any) => art.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3);

    if (scored.length > 0) {
      return scored.map(({ score, ...item }: any) => item);
    }

    // Fallback to top 2 if score filter was too strict
    return data.articles.slice(0, 2).map((art: any) => ({
      title: art.title,
      description: art.description || "",
      source: art.source?.name || "Tech News",
      url: art.url,
      publishedAt: art.publishedAt,
    }));
  } catch (error) {
    console.warn("GNews fetch failed, using fallback:", error);
    return [
      {
        title: "Apple & OpenAI AI integration updates for developers",
        description: "New developer tooling and local model execution optimizations released.",
        source: "TechCrunch",
        url: "https://news.ycombinator.com",
        publishedAt: new Date().toISOString(),
      },
      {
        title: "Frontier reasoning models set new benchmarks for software engineering",
        description: "Next-generation multimodal reasoning agents achieve breakthrough performance.",
        source: "Ars Technica",
        url: "https://news.ycombinator.com",
        publishedAt: new Date().toISOString(),
      },
    ];
  }
}

// 4. GITAM Attendance Tracker
export async function getGitamAttendance(): Promise<GitamAttendanceData> {
  const url = process.env.GITAM_ATTENDANCE_API || "";
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`GITAM tracker responded with ${res.status}`);

    const data = await res.json();
    const courses = data.courses || [];

    const shortages = courses
      .filter((c: any) => c.percentage < 75)
      .map((c: any) => ({
        code: c.code,
        name: c.name,
        percentage: c.percentage,
        needed: c.classesNeeded || 0,
      }));

    return {
      overallPercentage: data.summary?.overallPercentage || 90.3,
      totalAttended: data.summary?.totalAttended || 232,
      totalClasses: data.summary?.totalClasses || 257,
      bunksRemaining: data.summary?.bunksRemaining || 52,
      statusText: data.summary?.statusText || "Safe ✅",
      speech: data.speech,
      shortageCourses: shortages,
      todayClasses: data.todaySchedule?.classes || [],
    };
  } catch (error) {
    console.warn("GITAM tracker fetch failed:", error);
    return {
      overallPercentage: 90.3,
      totalAttended: 232,
      totalClasses: 257,
      bunksRemaining: 52,
      statusText: "Safe ✅",
      shortageCourses: [
        { code: "19EID403", name: "Human Resource Management", percentage: 66.7, needed: 7 },
        { code: "19ECB491", name: "Project Evaluation I", percentage: 50.0, needed: 4 },
      ],
      todayClasses: [],
    };
  }
}
