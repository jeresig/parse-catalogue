<style>
.img { overflow: auto; }
img { float: left; width: 220px; height: 220px; }
.details { float: left; }
</style>
{% for id, img in images %}
<div class="img">
    <a href="{{img.url}}">
        <img src="{{img.thumb}}"/>
    </a>
    <div class="details">
        <p>Pages: {% for page in img.pages %}
            <a href="test/pdf-pages/page-{{page - 1}}.jpg">{{page}}</a>
        {% endfor %}</p>
        <p>Sections:</p>
        <ul>
            {% for section in img.sections %}
                <li>{{section.heading}}</li>
            {% endfor %}
        </ul>
    </div>
</div>
{% endfor %}