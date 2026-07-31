export default {
  name: "instagram",
  category: "downloader",
  command: ["igdl", "instagram"],
  alias: [],
  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: true
  },
  run: async (conn, m, { Func }) => {
    const url = m.args[0];
    if (!url) return m.reply('Masukkan URL Instagram.\nContoh: .igdl https://www.instagram.com/reel/...');

    if (!Func.isUrl(url)) return m.reply('URL tidak valid.');

    const match = url.match(/\/(?:reel|p)\/([^/?]+)/);
    if (!match) return m.reply('Shortcode tidak ditemukan. Pastikan URL Instagram valid.');

    const shortcode = match[1];

    try {
      const body = new URLSearchParams({
        lsd: 'AdQfWAHEV3CjzVHcqBSQ7SXjohk',
        variables: JSON.stringify({
          shortcode,
          fetch_tagged_user_count: null,
          hoisted_comment_id: null,
          hoisted_reply_id: null
        }),
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
        doc_id: '8845758582119845'
      });

      const response = await fetch('https://www.instagram.com/graphql/query', {
        method: 'POST',
        headers: {
          'x-ig-app-id': '936619743392459',
          'x-asbd-id': '129477',
          'x-fb-lsd': 'AdQfWAHEV3CjzVHcqBSQ7SXjohk',
          'x-csrftoken': 'bXwH3Cx5udIR6yv6eRniKs',
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.84 Mobile Safari/537.36',
          'cookie': 'csrftoken=bXwH3Cx5udIR6yv6eRniKs; ig_did=EE08C07C-C81C-4EA1-8B68-77E1A390903B; mid=ajqFCwABAAFq3YdK9NHLXlLgngLa; ig_nrcb=1; ps_l=0'
        },
        body: body.toString()
      });

      const data = await response.json();

      if (!data.data || !data.data.xdt_shortcode_media) {
        return m.reply('Gagal mengambil data dari Instagram.');
      }

      const media = data.data.xdt_shortcode_media;
      const typename = media.__typename;

      let caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
      let videoUrl = '';
      let images = [];

      if (typename === 'XDTGraphVideo' || typename === 'XDTGraphVideo' || typename === 'GraphVideo') {
        if (media.video_url) {
          videoUrl = media.video_url;
        } else if (media.video_versions && media.video_versions.length) {
          videoUrl = media.video_versions[0].url;
        } else if (media.video_versions && media.video_versions.length > 0) {
          const sorted = media.video_versions.sort((a, b) => b.width - a.width);
          videoUrl = sorted[0].url;
        }
        if (videoUrl) {
          await conn.sendMessage(m.chat, {
            video: { url: videoUrl },
            caption: caption || '📹 Instagram Video'
          }, { quoted: m });
          return;
        }
      }

      if (typename === 'XDTGraphImage' || typename === 'GraphImage') {
        images.push(media.display_url || media.thumbnail_src);
      }

      if (typename === 'XDTGraphSidecar' || typename === 'GraphSidecar') {
        const edges = media.edge_sidecar_to_children?.edges || [];
        for (const edge of edges) {
          const node = edge.node;
          if (node.__typename === 'XDTGraphImage' || node.__typename === 'GraphImage') {
            images.push(node.display_url || node.thumbnail_src);
          } else if (node.__typename === 'XDTGraphVideo' || node.__typename === 'GraphVideo') {
            if (node.video_url || node.video_versions?.[0]?.url) {
              const vidUrl = node.video_url || node.video_versions[0].url;
              await conn.sendMessage(m.chat, {
                video: { url: vidUrl },
                caption: caption || '📹 Instagram Video'
              }, { quoted: m });
              caption = '';
            }
          }
        }
      }

      if (images.length === 0) {
        return m.reply('Tidak ditemukan media yang bisa diunduh.');
      }

      if (images.length === 1) {
        await conn.sendMessage(m.chat, {
          image: { url: images[0] },
          caption: caption || '📷 Instagram Photo'
        }, { quoted: m });
      } else {
        for (const img of images) {
          await conn.sendMessage(m.chat, {
            image: { url: img },
            caption: caption || '📷 Instagram Photo'
          }, { quoted: m });
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

    } catch (e) {
      console.error('Instagram download error:', e);
      return m.reply(`Terjadi error: ${e.message}`);
    }
  }
};