// Admin Panel JS

// Toggle product fields (stock/featured)
async function toggleField(id, field) {
  try {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    const res = await fetch(`/admin/products/toggle/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken || ''
      },
      body: JSON.stringify({ field })
    });
    const data = await res.json();
    if (data.success) {
      location.reload();
    }
  } catch (err) {
    console.error('Toggle failed:', err);
  }
}
