export async function register(){if(process.env.NEXT_RUNTIME==='nodejs'){const {startCollector}=await import('./lib/google-workflow');startCollector()}}
