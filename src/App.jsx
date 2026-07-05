import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import Lobby from '@/pages/Lobby'
import Games from '@/pages/Games'
import Roulette from '@/pages/Roulette'
import HighLow from '@/pages/HighLow'
import Dashboard from '@/pages/Dashboard'
import Tasks from '@/pages/Tasks'
import Ranking from '@/pages/Ranking'
import Store from '@/pages/Store'
import Withdraw from '@/pages/Withdraw'
import Dados from '@/pages/Dados'
import Profile from '@/pages/Profile'
import Crash from '@/pages/Crash'
import Tragamonedas from '@/pages/Tragamonedas'
import Loteria from '@/pages/Loteria'
import DailyReward from '@/pages/DailyReward'
import PageNotFound from '@/lib/PageNotFound'

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Lobby />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/roulette" element={<Roulette />} />
          <Route path="/games/highlow" element={<HighLow />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/store" element={<Store />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/games/dados" element={<Dados />} />
          <Route path="/games/crash" element={<Crash />} />
          <Route path="/games/tragamonedas" element={<Tragamonedas />} />
          <Route path="/games/loteria" element={<Loteria />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/daily-reward" element={<DailyReward />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Router>
  )
}

export default App