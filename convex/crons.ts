import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
crons.hourly('remove expired friend rooms', { minuteUTC: 0 }, internal.cleanup.expiredRooms, {});
export default crons;
