// Array JSON con le informazioni dei progetti
var projects = [
    {
      "name": "Elite",
      "category": "Software engineer",
      "image": "assets/img/portfolio/elite.jpg",
      "details": "https://github.com/MattManzi/Elite"
    },
    {
      "name": "BossBabe",
      "category": "Web App",
      "image": "assets/img/portfolio/bossbabe.jpg",
      "details": "https://github.com/MattManzi/BossBabe"
    }
  ];
  
 
   
  // Funzione per popolare la sezione dei progetti con i dati dell'array JSON
  function populateProjects() {
    var portfolioContainer = document.querySelector('.portfolio-container');
   
    for (var i = 0; i < projects.length; i++) {
        
        var colDiv = document.createElement('div');
        colDiv.classList.add('col-lg-4', 'col-md-6', 'portfolio-item');
      
        var wrapDiv = document.createElement('div');
        wrapDiv.classList.add('portfolio-wrap');
      
        var img = document.createElement('img');
        img.src = projects[i].image;
        img.classList.add('img-fluid');
        img.alt = '';
      
        var infoDiv = document.createElement('div');
        infoDiv.classList.add('portfolio-info');
      
        var projectName = document.createElement('h4');
        projectName.textContent = projects[i].name;
      
        var projectCategory = document.createElement('p');
        projectCategory.textContent = projects[i].category;
      
        var linksDiv = document.createElement('div');
        linksDiv.classList.add('portfolio-links');
      
        var link = document.createElement('a');
        link.href = projects[i].details;
        link.setAttribute('data-gallery', 'portfolioDetailsGallery');
        link.setAttribute('data-glightbox', 'type: external');
        link.classList.add('portfolio-details-lightbox');
        link.title = 'Portfolio Details';
      
        var linkIcon = document.createElement('i');
        linkIcon.classList.add('bx', 'bx-link');
      
        link.appendChild(linkIcon);
        linksDiv.appendChild(link);
        infoDiv.appendChild(projectName);
        infoDiv.appendChild(projectCategory);
        infoDiv.appendChild(linksDiv);
        wrapDiv.appendChild(img);
        wrapDiv.appendChild(infoDiv);
        colDiv.appendChild(wrapDiv);

        portfolioContainer.append(colDiv);
    }

    
  }
  
  // Chiama la funzione per popolare la sezione dei progetti

  window.onload=populateProjects();
  