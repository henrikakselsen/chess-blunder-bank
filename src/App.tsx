import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ImportPage } from './pages/ImportPage'
import { ListPage } from './pages/ListPage'
import { MateTrainingPage } from './pages/MateTrainingPage'
import { ReviewPage } from './pages/ReviewPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ImportPage />} />
          <Route path="list" element={<ListPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="mates" element={<MateTrainingPage />} />
          <Route path="settings" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
