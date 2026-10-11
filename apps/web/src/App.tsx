import { healthResponseSchema } from '@payops/shared';

const appContract = healthResponseSchema.keyof().options.join(', ');

export default function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '15vh auto',
        padding: 24,
      }}
    >
      <h1>PayOps</h1>

      <p>AI proposes. Policy decides. Humans approve. PayPal confirms.</p>

      <p style={{ color: '#667' }}>Console coming soon. Sandbox only.</p>

      <small>Shared contract fields: {appContract}</small>
    </main>
  );
}
