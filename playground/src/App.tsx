import { useState } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <div className="flex gap-3">
        <a
          className="flex-auto aspect-square justify-center items-center p-3"
          href="https://vitejs.dev"
          target="_blank"
        >
          <img src="/vite.svg" className="logo w-full" alt="Vite logo" />
        </a>
        <a
          className="flex-auto aspect-square justify-center items-center p-3"
          href="https://reactjs.org"
          target="_blank"
        >
          <img src={reactLogo} className="logo w-full react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount(count => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}

export default App
