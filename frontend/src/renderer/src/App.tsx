import React from 'react'
import LoginForm from './components/LoginForm'

function App(): React.JSX.Element {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <LoginForm />
    </main>
  )
}

export default App
